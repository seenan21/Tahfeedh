import { Router } from 'express';
import {
  testCreateSchema,
  logErrorSchema,
  finishTestSchema,
  type QuranIndex,
} from '@tahfeedh/shared';
import { verifyUser, AuthError } from '../auth/verifyUser.js';
import { supabaseAdmin } from '../supabase.js';
import { resolveTestRanges } from '../pipelines/post-test/resolve.js';
import { pushBookmark } from '../qf/bookmarks.js';
import { pushNote } from '../qf/notes.js';
import quranIndexJson from '../data/quran-index.json' with { type: 'json' };

const quranIndex = quranIndexJson as unknown as QuranIndex;

export const testsRouter = Router();

/**
 * POST /api/tests/create
 * Creates a new in_progress test row. Student-initiated guest tests use
 * test_mode='guest_teacher' and teacher_id=null (ADR 0004). Enrolled-teacher
 * tests would set teacher_id to the caller — that flow lands in M6.
 */
testsRouter.post('/create', async (req, res, next) => {
  try {
    const user = await verifyUser(req);

    const parsed = testCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid payload', details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    let studentId: string;
    let teacherId: string | null;

    if (body.test_mode === 'enrolled_teacher') {
      // Teacher is the caller. Verify active enrollment with body.student_id.
      const targetStudentId = body.student_id!;
      const { data: enrollmentRow, error: enrErr } = await supabaseAdmin
        .from('enrollment')
        .select('id')
        .eq('teacher_id', user.id)
        .eq('student_id', targetStudentId)
        .eq('status', 'active')
        .maybeSingle();
      if (enrErr) {
        console.error('[tests/create] enrollment lookup failed', enrErr);
        res.status(500).json({ error: enrErr.message });
        return;
      }
      if (!enrollmentRow) {
        res.status(403).json({ error: 'no active enrollment with that student' });
        return;
      }
      studentId = targetStudentId;
      teacherId = user.id;
    } else {
      // guest_teacher — student-initiated; caller is the student.
      studentId = user.id;
      teacherId = null;
    }

    const { data, error } = await supabaseAdmin
      .from('test')
      .insert({
        student_id: studentId,
        teacher_id: teacherId,
        test_type: body.test_type,
        status: 'in_progress',
        ranges: body.ranges,
        test_mode: body.test_mode,
        guest_tester_name: body.guest_tester_name ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[tests/create] insert failed', error);
      // 23505 = unique_violation on the partial index test_one_open_per_student
      if (error.code === '23505') {
        res.status(409).json({ error: 'an in-progress test already exists' });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ id: data.id });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/**
 * POST /api/tests/:id/error
 * Streams a single error_log row into the test (ADR 0018). Verifies the
 * caller owns the test and that it's still in_progress.
 */
testsRouter.post('/:id/error', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    const testId = req.params.id;

    const parsed = logErrorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid payload', details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    const { data: testRow, error: tErr } = await supabaseAdmin
      .from('test')
      .select('id, student_id, teacher_id, status')
      .eq('id', testId)
      .single();
    if (tErr || !testRow) {
      res.status(404).json({ error: 'test not found' });
      return;
    }
    if (testRow.status !== 'in_progress') {
      res.status(409).json({ error: 'test is not in_progress' });
      return;
    }
    if (user.id !== testRow.student_id && user.id !== testRow.teacher_id) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('error_log')
      .insert({
        test_id: testId,
        student_id: testRow.student_id,
        surah_number: body.surah,
        ayah_number: body.ayah,
        word_position: body.word_position ?? null,
        word_position_end: body.word_position_end ?? null,
        error_type: body.error_type,
        severity: body.severity,
        teacher_note: body.teacher_note ?? null,
        related_surah: body.related_surah ?? null,
        related_ayah: body.related_ayah ?? null,
      })
      .select('id, signature')
      .single();

    if (error) {
      console.error('[tests/error] insert failed', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Fire-and-forget sync of the teacher's note to QF Notes. Never blocks
    // the response; failures are logged inside pushNote.
    if (body.teacher_note && body.teacher_note.trim().length > 0) {
      void pushNote(testRow.student_id, {
        body: body.teacher_note,
        surah: body.surah,
        ayah: body.ayah,
      });
    }

    res.json({ id: data.id, signature: data.signature });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

/**
 * POST /api/tests/:id/finish
 * Closes the test, runs the post-test pipeline, returns the summary.
 * Resolves test.ranges into coveredAyahs/coveredPages here so the SQL fn
 * does not need to know about the static quran index.
 */
testsRouter.post('/:id/finish', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    const testId = req.params.id;

    const parsed = finishTestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid payload', details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    const { data: testRow, error: tErr } = await supabaseAdmin
      .from('test')
      .select('id, student_id, teacher_id, status, ranges')
      .eq('id', testId)
      .single();
    if (tErr || !testRow) {
      res.status(404).json({ error: 'test not found' });
      return;
    }
    if (testRow.status !== 'in_progress') {
      res.status(409).json({ error: 'test is not in_progress' });
      return;
    }
    if (user.id !== testRow.student_id && user.id !== testRow.teacher_id) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    let resolved;
    try {
      resolved = resolveTestRanges(testRow.ranges, quranIndex);
    } catch (rangeErr) {
      const msg = rangeErr instanceof Error ? rangeErr.message : 'range resolution failed';
      res.status(400).json({ error: msg });
      return;
    }

    const { data, error } = await supabaseAdmin.rpc('submit_test', {
      p_test_id: testId,
      p_payload: {
        rating: body.rating,
        notes: body.notes ?? null,
        coveredAyahs: resolved.coveredAyahs,
        coveredPages: resolved.coveredPages,
        coveredPageAyahs: resolved.coveredPageAyahs,
      },
    });

    if (error) {
      console.error('[tests/finish] submit_test rpc failed', error);
      res.status(500).json({ error: error.message });
      return;
    }

    // Fire-and-forget QF Bookmarks push for the student's furthest ayah on
    // this test — represents "where they are now" in their hifz frontier.
    // Skipped silently if the student has no qf_user_token row.
    if (resolved.coveredPageAyahs.length > 0) {
      const last = resolved.coveredPageAyahs[resolved.coveredPageAyahs.length - 1]!;
      void pushBookmark(testRow.student_id, { surah: last.surah, ayah: last.ayah });
    }

    res.json({ ok: true, summary: data });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
