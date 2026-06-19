import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { CheckCircle2, AlertCircle, Clock, ArrowRight, ArrowLeft, Send, Award, RefreshCw, ClipboardCheck, RotateCcw, LogIn, PlayCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Question {
  id: string | number;
  question_text: string;
  options: string[];
  correct_option_index: number;
  score: number;
}

interface Quiz {
  id: string | number;
  title: string;
  description: string;
  duration_minutes: number;
}

const FALLBACK_QUIZ: Quiz = {
  id: 1,
  title: 'Bài Thu Hoạch Kiến Thức Logistics Cơ Bản',
  description: 'Bài trắc nghiệm đánh giá kiến thức cơ bản về chuỗi cung ứng, vận tải, và quản trị kho bãi dành cho học viên chương trình đào tạo ONEX Training.',
  duration_minutes: 15,
};

const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 1,
    question_text: 'Mục tiêu tối cao của quản trị Logistics là gì?',
    options: [
      'Tối thiểu hóa chi phí nhưng vẫn đạt chất lượng dịch vụ khách hàng mong muốn',
      'Tối đa hóa doanh thu bán hàng của doanh nghiệp',
      'Sở hữu hệ thống kho bãi rộng lớn nhất để tích trữ hàng',
      'Cắt giảm tối đa số lượng nhân sự trong chuỗi cung ứng'
    ],
    correct_option_index: 0,
    score: 10,
  },
  {
    id: 2,
    question_text: 'Hoạt động nào sau đây KHÔNG thuộc chuỗi hoạt động Logistics cốt lõi?',
    options: [
      'Vận tải nội địa và quốc tế',
      'Quản lý hàng tồn kho',
      'Nghiên cứu & phát triển sản phẩm mới (R&D)',
      'Đóng gói, dán nhãn hàng hóa'
    ],
    correct_option_index: 2,
    score: 10,
  },
  {
    id: 3,
    question_text: 'Thuật ngữ "Incoterms" viết tắt của cụm từ tiếng Anh nào?',
    options: [
      'International Commercial Terms',
      'Internal Corporation Terms',
      'Industry Cooperative Terms',
      'International Cargo Terms'
    ],
    correct_option_index: 0,
    score: 10,
  },
  {
    id: 4,
    question_text: 'Trong chuỗi cung ứng, mô hình phân phối hàng hóa "Cross-docking" có tác dụng gì?',
    options: [
      'Tăng thời gian lưu kho của hàng hóa nhằm tối ưu doanh số',
      'Chuyển tiếp hàng hóa trực tiếp từ phương tiện nhận sang phương tiện giao mà không qua lưu trữ trung gian',
      'Tự động hóa toàn bộ quy trình đóng gói trong kho',
      'Giảm số lượng phương tiện vận tải đường bộ khi xếp hàng lẻ'
    ],
    correct_option_index: 1,
    score: 10,
  },
  {
    id: 5,
    question_text: 'Thuật ngữ "3PL" viết tắt cho loại hình dịch vụ logistics nào?',
    options: [
      'Third Party Logistics (Cung cấp dịch vụ logistics bên thứ ba)',
      'Three Port Logistics (Dịch vụ vận chuyển qua ba cảng liên kết)',
      'Triple Partners Logistics (Hợp tác liên minh ba bên)',
      'Third Port Location (Vị trí bốc dỡ hàng thứ ba)'
    ],
    correct_option_index: 0,
    score: 10,
  }
];

type Step = 'register' | 'testing' | 'submitted1' | 'retry' | 'result';

export default function QuizSection() {
  const [quiz, setQuiz] = useState<Quiz>(FALLBACK_QUIZ);
  const [questions, setQuestions] = useState<Question[]>(FALLBACK_QUESTIONS);
  const [isLoading, setIsLoading] = useState(true);

  const [fullname, setFullname] = useState('');
  const [studentCode, setStudentCode] = useState('');

  const [step, setStep] = useState<Step>('register');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [scoreResult, setScoreResult] = useState({ score: 0, correctAnswers: 0, totalQuestions: 0 });

  // Submit warning modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitModalMode, setSubmitModalMode] = useState<'quiz' | 'retry'>('quiz');

  // Retry states
  const [retryQuestionIndices, setRetryQuestionIndices] = useState<number[]>([]);
  const [retryAnswers, setRetryAnswers] = useState<Record<number, number>>({});
  const [retryCurrentIdx, setRetryCurrentIdx] = useState(0);
  const [retryResult, setRetryResult] = useState<{ score: number; correctAnswers: number; totalQuestions: number } | null>(null);

  // Session persistence states
  const [, setSessionId] = useState<number | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const timerRef = useRef<any>(null);
  const submitQuizRef = useRef<() => void>(() => {});
  const submitRetryRef = useRef<() => void>(() => {});

  // Refs for use inside timer callbacks (avoid stale closure)
  const sessionIdRef = useRef<number | null>(null);
  const timeLeftRef = useRef(0);
  const initialTimeLeftRef = useRef(0);

  // Keep timeLeftRef in sync for the periodic save interval
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const loadQuiz = async () => {
    setIsLoading(true);
    try {
      const { data: activeSetting } = await supabase
        .from('onex_settings')
        .select('value')
        .eq('key', 'active_quiz_id')
        .maybeSingle();

      let quizQuery = supabase.from('onex_quizzes').select('*');
      if (activeSetting?.value) {
        quizQuery = quizQuery.eq('id', activeSetting.value);
      } else {
        quizQuery = quizQuery.order('id', { ascending: true }).limit(1);
      }

      const { data: quizData, error: quizError } = await quizQuery;
      if (quizError) throw quizError;

      if (quizData && quizData.length > 0) {
        const activeQuiz = quizData[0];
        setQuiz(activeQuiz);
        const { data: questionsData, error: questionsError } = await supabase
          .from('onex_questions')
          .select('*')
          .eq('quiz_id', activeQuiz.id)
          .order('id', { ascending: true });
        if (questionsError) throw questionsError;
        if (questionsData && questionsData.length > 0) {
          const visibleQuestions = questionsData.filter((q: any) => !q.is_hidden);
          if (visibleQuestions.length > 0) {
            setQuestions(visibleQuestions);
          } else {
            setQuestions(FALLBACK_QUESTIONS);
          }
        } else {
          setQuestions(FALLBACK_QUESTIONS);
        }
      } else {
        setQuiz(FALLBACK_QUIZ);
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch (err) {
      console.warn('Failed to load quiz from Supabase:', err);
      setQuiz(FALLBACK_QUIZ);
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadQuiz(); }, []);

  useEffect(() => {
    if (step === 'testing' || step === 'retry' || step === 'submitted1') {
      const initTime = initialTimeLeftRef.current || quiz.duration_minutes * 60;
      setTimeLeft(initTime);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            if (step === 'testing') submitQuizRef.current();
            else if (step === 'retry') submitRetryRef.current();
            // For 'submitted1': timer just stops at 0:00, retry button becomes disabled
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Save time_left every 30 seconds so resume shows accurate remaining time
      const timeSaveInterval = setInterval(() => {
        saveSession({ time_left: timeLeftRef.current });
      }, 30000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        clearInterval(timeSaveInterval);
      };
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  // ── Session persistence helpers ───────────────────────────────────────────

  const saveSession = async (updates: Record<string, any>) => {
    if (!sessionIdRef.current) return;
    try {
      await supabase
        .from('onex_quiz_sessions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', sessionIdRef.current);
    } catch {}
  };

  const startNewSession = async () => {
    const initTime = quiz.duration_minutes * 60;
    initialTimeLeftRef.current = initTime;

    try {
      const { data: session } = await supabase
        .from('onex_quiz_sessions')
        .insert({
          student_code: studentCode.trim(),
          fullname,
          quiz_id: quiz.id,
          step: 'testing',
          current_idx: 0,
          answers_json: {},
          time_left: initTime,
        })
        .select()
        .single();

      if (session) {
        sessionIdRef.current = session.id;
        setSessionId(session.id);
      }
    } catch {}

    setStep('testing');
    setCurrentIdx(0);
    setAnswers({});
  };

  const handleResumeSession = async () => {
    if (!resumeData) return;
    const savedTime = resumeData.time_left > 0 ? resumeData.time_left : quiz.duration_minutes * 60;
    initialTimeLeftRef.current = savedTime;
    sessionIdRef.current = resumeData.id;
    setSessionId(resumeData.id);
    setAnswers((resumeData.answers_json || {}) as Record<number, number>);
    setCurrentIdx(resumeData.current_idx || 0);
    if (resumeData.step === 'retry') {
      setRetryQuestionIndices(resumeData.retry_indices || []);
      setRetryAnswers((resumeData.retry_answers_json || {}) as Record<number, number>);
      setRetryCurrentIdx(resumeData.retry_current_idx || 0);
    }
    if (resumeData.step === 'submitted1') {
      try {
        const { data: sub } = await supabase
          .from('onex_submissions')
          .select('score, correct_answers, total_questions')
          .eq('student_code', studentCode.trim())
          .eq('quiz_id', quiz.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (sub) {
          setScoreResult({ score: sub.score, correctAnswers: sub.correct_answers, totalQuestions: sub.total_questions });
        }
      } catch {}
    }
    setShowResumeModal(false);
    setResumeData(null);
    setStep(resumeData.step || 'testing');
  };

  const handleRestartSession = async () => {
    if (resumeData) {
      try {
        await supabase
          .from('onex_quiz_sessions')
          .update({ is_completed: true })
          .eq('id', resumeData.id);
      } catch {}
    }
    setShowResumeModal(false);
    setResumeData(null);
    await startNewSession();
  };

  // ── Register ──────────────────────────────────────────────────────────────

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullname || !studentCode) return;
    setIsChecking(true);

    try {
      const { data: existing } = await supabase
        .from('onex_quiz_sessions')
        .select('*')
        .eq('student_code', studentCode.trim())
        .eq('quiz_id', quiz.id)
        .eq('is_completed', false)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setResumeData(existing);
        setIsChecking(false);
        setShowResumeModal(true);
        return;
      }
    } catch {}

    setIsChecking(false);
    await startNewSession();
  };

  const selectAnswer = (optionIndex: number) => {
    const newAnswers = { ...answers, [currentIdx]: optionIndex };
    setAnswers(newAnswers);
    saveSession({ answers_json: newAnswers, current_idx: currentIdx });
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      saveSession({ current_idx: nextIdx });
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      setCurrentIdx(prevIdx);
      saveSession({ current_idx: prevIdx });
    }
  };

  const handleSubmitQuiz = async () => {
    // Don't clear timer — it continues running so the student can use remaining time for retry
    setSubmitting(true);
    setSubmitError('');

    let totalScore = 0;
    let correct = 0;
    const maxPossible = questions.reduce((s, q) => s + q.score, 0);
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_option_index) { totalScore += q.score; correct++; }
    });
    const results = {
      score: parseFloat(((totalScore / maxPossible) * 10).toFixed(1)),
      correctAnswers: correct,
      totalQuestions: questions.length,
    };

    try {
      const finalAnswers: Record<string, number> = {};
      questions.forEach((q, idx) => { finalAnswers[String(q.id)] = answers[idx] !== undefined ? answers[idx] : -1; });
      const { error } = await supabase.from('onex_submissions').insert({
        fullname, student_code: studentCode, email: '', phone: '',
        quiz_id: quiz.id, score: results.score,
        total_questions: results.totalQuestions, correct_answers: results.correctAnswers,
        answers_json: finalAnswers,
      });
      if (error) throw error;

      // Save step as 'submitted1' — session not yet completed, student may still retry
      if (sessionIdRef.current) {
        await supabase
          .from('onex_quiz_sessions')
          .update({ step: 'submitted1' })
          .eq('id', sessionIdRef.current);
      }

      if (results.score >= 5.0) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b', '#d97706', '#10b981'] });
      }
    } catch (err: any) {
      console.error('Error submitting quiz:', err);
      setSubmitError('Không thể gửi kết quả thi lên hệ thống. Vui lòng kiểm tra lại kết nối hoặc liên hệ admin.');
    } finally {
      setSubmitting(false);
    }
    setScoreResult(results);
    // Preserve remaining time so 'submitted1' timer continues from where it left off
    initialTimeLeftRef.current = timeLeftRef.current;
    setStep('submitted1');
  };
  submitQuizRef.current = handleSubmitQuiz;

  // ── Retry logic ──────────────────────────────────────────────────────────

  const handleStartRetry = () => {
    const wrongIndices = questions.reduce<number[]>((acc, q, idx) => {
      if (answers[idx] !== q.correct_option_index) acc.push(idx);
      return acc;
    }, []);
    setRetryQuestionIndices(wrongIndices);
    setRetryAnswers({});
    setRetryCurrentIdx(0);
    // Continue from remaining time — don't reset the timer
    initialTimeLeftRef.current = timeLeftRef.current;
    saveSession({
      step: 'retry',
      retry_indices: wrongIndices,
      retry_answers_json: {},
      retry_current_idx: 0,
    });
    setStep('retry');
  };

  const selectRetryAnswer = (origIdx: number, optIdx: number) => {
    const newRetryAnswers = { ...retryAnswers, [origIdx]: optIdx };
    setRetryAnswers(newRetryAnswers);
    saveSession({ retry_answers_json: newRetryAnswers });
  };

  const handleRetryNext = () => {
    if (retryCurrentIdx < retryQuestionIndices.length - 1) {
      const nextIdx = retryCurrentIdx + 1;
      setRetryCurrentIdx(nextIdx);
      saveSession({ retry_current_idx: nextIdx });
    }
  };

  const handleRetryPrev = () => {
    if (retryCurrentIdx > 0) {
      const prevIdx = retryCurrentIdx - 1;
      setRetryCurrentIdx(prevIdx);
      saveSession({ retry_current_idx: prevIdx });
    }
  };

  const handleSubmitRetry = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);
    setSubmitError('');

    let totalScore = 0;
    let totalCorrect = 0;
    const maxPossible = questions.reduce((s, q) => s + q.score, 0);
    questions.forEach((q, idx) => {
      const wasCorrect = answers[idx] === q.correct_option_index;
      const isRetryCorrect = retryQuestionIndices.includes(idx) && retryAnswers[idx] === q.correct_option_index;
      if (wasCorrect || isRetryCorrect) { totalScore += q.score; totalCorrect++; }
    });
    const results = {
      score: parseFloat(((totalScore / maxPossible) * 10).toFixed(1)),
      correctAnswers: totalCorrect,
      totalQuestions: questions.length,
    };

    try {
      const finalAnswers: Record<string, number> = {};
      questions.forEach((q, idx) => {
        finalAnswers[String(q.id)] = retryQuestionIndices.includes(idx)
          ? (retryAnswers[idx] !== undefined ? retryAnswers[idx] : -1)
          : (answers[idx] !== undefined ? answers[idx] : -1);
      });
      const { error } = await supabase.from('onex_submissions').insert({
        fullname, student_code: studentCode, email: '', phone: '',
        quiz_id: quiz.id, score: results.score,
        total_questions: results.totalQuestions, correct_answers: results.correctAnswers,
        answers_json: finalAnswers,
        attempt_number: 2,
      });
      if (error) throw error;

      // Mark session as completed
      if (sessionIdRef.current) {
        await supabase
          .from('onex_quiz_sessions')
          .update({ is_completed: true, step: 'result' })
          .eq('id', sessionIdRef.current);
      }

      if (results.score >= 5.0 && scoreResult.score < 5.0) {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24', '#f59e0b', '#d97706', '#10b981'] });
      }
    } catch (err: any) {
      console.error('Error submitting retry:', err);
      setSubmitError('Không thể gửi kết quả lần 2 lên hệ thống. Vui lòng liên hệ admin.');
    } finally {
      setSubmitting(false);
    }
    setRetryResult(results);
    setStep('result');
  };
  submitRetryRef.current = handleSubmitRetry;

  const handleFullRetry = () => {
    sessionIdRef.current = null;
    setSessionId(null);
    initialTimeLeftRef.current = 0;
    setStep('register');
    setAnswers({});
    setCurrentIdx(0);
    setRetryQuestionIndices([]);
    setRetryAnswers({});
    setRetryCurrentIdx(0);
    setRetryResult(null);
    setSubmitError('');
  };

  const handleOpenSubmitModal = (mode: 'quiz' | 'retry') => {
    setSubmitModalMode(mode);
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = () => {
    setShowSubmitModal(false);
    if (submitModalMode === 'quiz') handleSubmitQuiz();
    else handleSubmitRetry();
  };

  const unansweredIndices = questions
    .map((_, idx) => idx)
    .filter(idx => answers[idx] === undefined);

  const unansweredRetryIndices = retryQuestionIndices
    .filter(origIdx => retryAnswers[origIdx] === undefined);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-200)', borderTopColor: 'var(--primary-500)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p>Đang tải câu hỏi trắc nghiệm...</p>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  const wrongIndicesInResult = questions.reduce<number[]>((acc, q, idx) => {
    if (answers[idx] !== q.correct_option_index) acc.push(idx);
    return acc;
  }, []);

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* ── 1. REGISTER ── */}
      {step === 'register' && (
        <div className="glass-card card-body-pad" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'var(--primary-200)', borderRadius: '50%', color: 'var(--primary-800)', marginBottom: '1rem' }}>
              <ClipboardCheck size={36} />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{quiz.title}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
              <span className="badge badge-primary">SỐ CÂU HỎI: {questions.length} CÂU</span>
              <span className="badge badge-primary"><Clock size={12} style={{ marginRight: '0.25rem' }} /> THỜI GIAN: {quiz.duration_minutes} PHÚT</span>
            </div>
          </div>
          <form onSubmit={handleRegister} style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Họ và tên nhân viên *</label>
              <input type="text" required className="form-input" placeholder="Nguyễn Văn A" value={fullname} onChange={(e) => setFullname(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Mã nhân viên ICD *</label>
              <input type="text" required className="form-input" placeholder="ONEX-2026-XXXX" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isChecking}
              style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.05rem', padding: '0.85rem', opacity: isChecking ? 0.7 : 1 }}
            >
              {isChecking ? (
                <>
                  <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  Đang kiểm tra...
                </>
              ) : (
                <>Bắt đầu làm bài thu hoạch <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── 2. TESTING ── */}
      {step === 'testing' && (
        <div>
          <div className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--primary-200)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Thí sinh:</span>
              <strong style={{ marginLeft: '0.25rem', color: 'var(--neutral-800)' }}>{fullname}</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-400)', marginLeft: '0.5rem' }}>({studentCode})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: timeLeft < 60 ? 'var(--error-bg)' : 'var(--primary-200)', color: timeLeft < 60 ? 'var(--error)' : 'var(--primary-800)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }}>
                <Clock size={16} />
                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{formatTime(timeLeft)}</span>
              </div>
              <button
                onClick={() => handleOpenSubmitModal('quiz')}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-full)',
                  border: '2px solid var(--success)', backgroundColor: 'var(--success)',
                  color: '#ffffff', fontWeight: 700, fontSize: '0.875rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)',
                  transition: 'var(--transition-smooth)',
                }}
              >
                <LogIn size={15} /> Nộp bài ngay
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--neutral-200)', height: '8px', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--primary-500)', height: '100%', width: `${(Object.keys(answers).length / questions.length) * 100}%`, transition: 'var(--transition-smooth)' }} />
          </div>

          <div className="glass-card card-body-pad" style={{ padding: '2.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span className="badge badge-primary">Câu {currentIdx + 1} / {questions.length}</span>
            </div>
            <h3 style={{ fontSize: '1.35rem', color: 'var(--neutral-800)', marginBottom: '1.5rem', fontWeight: 600 }}>
              {questions[currentIdx].question_text}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {questions[currentIdx].options.map((option, optIdx) => {
                const isSelected = answers[currentIdx] === optIdx;
                return (
                  <button key={optIdx} onClick={() => selectAnswer(optIdx)} style={{ textAlign: 'left', padding: '1.1rem 1.25rem', borderRadius: 'var(--radius-md)', border: isSelected ? '2px solid var(--primary-500)' : '1px solid var(--primary-200)', backgroundColor: isSelected ? 'var(--primary-100)' : '#ffffff', color: isSelected ? 'var(--primary-900)' : 'var(--neutral-700)', fontWeight: isSelected ? '600' : '400', boxShadow: isSelected ? 'var(--shadow-sm)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: isSelected ? '6px solid var(--primary-500)' : '2px solid var(--primary-300)', backgroundColor: '#ffffff', flexShrink: 0 }} />
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(() => {
            const total = questions.length;
            let startIdx = 0;
            let endIdx = total - 1;

            if (total > 5) {
              startIdx = currentIdx - 2;
              endIdx = currentIdx + 2;

              if (startIdx < 0) {
                startIdx = 0;
                endIdx = 4;
              } else if (endIdx >= total) {
                endIdx = total - 1;
                startIdx = total - 5;
              }
            }

            const visibleIndices = [];
            for (let i = startIdx; i <= endIdx; i++) {
              visibleIndices.push(i);
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                  <button
                    onClick={handlePrev}
                    disabled={currentIdx === 0}
                    title="Quay lại"
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid var(--primary-300)', backgroundColor: '#ffffff',
                      color: 'var(--neutral-700)',
                      cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                      opacity: currentIdx === 0 ? 0.5 : 1,
                      transition: 'var(--transition-smooth)', boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {visibleIndices.map((idx) => {
                      const isAnswered = answers[idx] !== undefined;
                      const isCurrent = currentIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => { setCurrentIdx(idx); saveSession({ current_idx: idx }); }}
                          style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.9rem', fontWeight: 'bold',
                            border: isCurrent ? '2px solid var(--neutral-800)' : '1px solid var(--primary-300)',
                            backgroundColor: isCurrent ? 'var(--primary-300)' : (isAnswered ? 'var(--primary-200)' : '#ffffff'),
                            color: isCurrent ? 'var(--neutral-900)' : 'var(--neutral-700)',
                            cursor: 'pointer', transition: 'var(--transition-smooth)'
                          }}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={currentIdx === questions.length - 1}
                    title="Tiếp tục"
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid var(--primary-300)', backgroundColor: '#ffffff',
                      color: 'var(--neutral-700)',
                      cursor: currentIdx === questions.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: currentIdx === questions.length - 1 ? 0.5 : 1,
                      transition: 'var(--transition-smooth)', boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>

                {currentIdx === questions.length - 1 && (
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{
                      backgroundColor: 'var(--success)', color: '#ffffff',
                      padding: '0.6rem 1.5rem', fontSize: '0.95rem',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: 'var(--shadow-md)'
                    }}
                  >
                    {submitting ? 'Đang gửi...' : 'Nộp bài thi'} <Send size={16} />
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── 3. SUBMITTED1 — Kết quả lần 1, đồng hồ vẫn chạy ── */}
      {step === 'submitted1' && (
        <div className="glass-card card-body-pad" style={{ padding: '2.5rem' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .q-circle-retry:hover { transform: scale(1.12); box-shadow: 0 4px 14px rgba(239,68,68,0.35); }
          ` }} />

          {/* Timer bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', backgroundColor: timeLeft === 0 ? 'var(--error-bg)' : 'var(--primary-100)', border: `1px solid ${timeLeft === 0 ? 'var(--error)' : 'var(--primary-200)'}` }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: timeLeft === 0 ? 'var(--error)' : 'var(--primary-700)' }}>
              {timeLeft === 0 ? 'Hết thời gian — Không thể làm lại lần 2' : 'Thời gian còn lại để làm lại lần 2'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: timeLeft < 60 ? 'var(--error-bg)' : 'var(--primary-200)', color: timeLeft < 60 ? 'var(--error)' : 'var(--primary-800)', padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }}>
              <Clock size={15} />
              <span style={{ fontFamily: 'monospace', fontSize: '1rem' }}>{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: scoreResult.score >= 5.0 ? 'var(--success-bg)' : 'var(--error-bg)', borderRadius: '50%', color: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--error)', marginBottom: '1.25rem' }}>
              <Award size={48} />
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Kết Quả Lần 1</h2>
            <p style={{ color: 'var(--neutral-500)', fontSize: '0.95rem' }}>Thí sinh: <strong>{fullname}</strong> ({studentCode})</p>

            {submitError && (
              <div style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.5rem', alignItems: 'center', maxWidth: '500px', margin: '1rem auto 0', fontSize: '0.85rem', textAlign: 'left' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ margin: '0 auto', width: '150px', height: '150px', borderRadius: '50%', border: '8px solid var(--primary-200)', borderTopColor: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--primary-400)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-lg)' }}>
              <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1 }}>{scoreResult.score}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', fontWeight: 600, marginTop: '0.25rem' }}>Thang điểm 10</span>
            </div>
            <h3 style={{ color: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--primary-700)', marginTop: '1rem', marginBottom: '0.25rem', fontSize: '1.15rem' }}>
              {scoreResult.score >= 8.0
                ? 'Xuất sắc! Bạn nắm kiến thức logistics rất tốt.'
                : scoreResult.score >= 5.0
                  ? 'Đạt yêu cầu! Chúc mừng bạn đã hoàn thành bài thu hoạch.'
                  : 'Cần cố gắng thêm! Bạn nên ôn tập lại kiến thức.'}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--neutral-500)' }}>
              Trả lời đúng: <strong>{scoreResult.correctAnswers}</strong> / <strong>{scoreResult.totalQuestions}</strong> câu hỏi
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--primary-200)', margin: '1.5rem 0' }} />

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: '1rem' }}>
              {wrongIndicesInResult.length > 0
                ? timeLeft > 0 ? 'Bấm vào câu đỏ để làm lại lần 2' : 'Hết thời gian — không thể làm lại'
                : 'Tất cả câu trả lời đúng!'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {questions.map((q, idx) => {
                const isCorrect = answers[idx] === q.correct_option_index;
                const isClickable = !isCorrect && timeLeft > 0;
                return (
                  <div
                    key={idx}
                    className={isClickable ? 'q-circle-retry' : ''}
                    title={isClickable ? `Câu ${idx + 1} — Bấm để làm lại lần 2` : `Câu ${idx + 1}`}
                    onClick={() => isClickable && handleStartRetry()}
                    style={{
                      width: '68px', height: '68px', borderRadius: '50%',
                      backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2',
                      border: `3px solid ${isCorrect ? 'var(--success)' : 'var(--error)'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: isClickable ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      userSelect: 'none',
                      opacity: !isCorrect && timeLeft === 0 ? 0.5 : 1,
                    }}
                  >
                    {isCorrect
                      ? <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
                      : <AlertCircle size={22} style={{ color: 'var(--error)' }} />}
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isCorrect ? 'var(--success)' : 'var(--error)', marginTop: '0.15rem' }}>Câu {idx + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            {wrongIndicesInResult.length > 0 && (
              <button
                onClick={handleStartRetry}
                disabled={timeLeft === 0}
                className="btn btn-primary"
                style={{
                  backgroundColor: timeLeft > 0 ? 'var(--error)' : 'var(--neutral-300)',
                  color: '#ffffff',
                  cursor: timeLeft === 0 ? 'not-allowed' : 'pointer',
                  opacity: timeLeft === 0 ? 0.6 : 1,
                }}
                title={timeLeft === 0 ? 'Hết thời gian, không thể làm lại' : ''}
              >
                <RotateCcw size={16} /> Làm lại {wrongIndicesInResult.length} câu sai
                {timeLeft === 0 && ' (Hết giờ)'}
              </button>
            )}
            <button onClick={handleFullRetry} className="btn btn-outline">
              <RefreshCw size={16} /> Làm lại từ đầu
            </button>
          </div>
        </div>
      )}

      {/* ── 4. RETRY ── */}
      {step === 'retry' && retryQuestionIndices.length > 0 && (() => {
        const origIdx = retryQuestionIndices[retryCurrentIdx];
        const q = questions[origIdx];
        const selected = retryAnswers[origIdx];
        return (
          <div>
            <div className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '2px solid var(--error-bg)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Làm lại — Lần 2</span>
                <div style={{ fontSize: '0.875rem', color: 'var(--neutral-600)', marginTop: '0.1rem' }}>
                  {fullname} <span style={{ color: 'var(--neutral-400)' }}>({studentCode})</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: timeLeft < 60 ? 'var(--error-bg)' : 'var(--primary-200)', color: timeLeft < 60 ? 'var(--error)' : 'var(--primary-800)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }}>
                  <Clock size={16} />
                  <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{formatTime(timeLeft)}</span>
                </div>
                <button
                  onClick={() => handleOpenSubmitModal('retry')}
                  disabled={submitting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-full)',
                    border: '2px solid var(--success)', backgroundColor: 'var(--success)',
                    color: '#ffffff', fontWeight: 700, fontSize: '0.875rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                    whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)',
                    transition: 'var(--transition-smooth)',
                  }}
                >
                  <LogIn size={15} /> Nộp bài ngay
                </button>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--neutral-200)', height: '8px', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
              <div style={{ backgroundColor: 'var(--error)', height: '100%', width: `${(Object.keys(retryAnswers).length / retryQuestionIndices.length) * 100}%`, transition: 'var(--transition-smooth)' }} />
            </div>

            <div className="glass-card card-body-pad" style={{ padding: '2.5rem', marginBottom: '1.5rem', borderTop: '4px solid var(--error)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span className="badge" style={{ backgroundColor: '#fef2f2', color: 'var(--error)', border: '1px solid var(--error)' }}>
                  Câu sai {retryCurrentIdx + 1} / {retryQuestionIndices.length}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Câu gốc số {origIdx + 1}</span>
              </div>
              <h3 style={{ fontSize: '1.35rem', color: 'var(--neutral-800)', marginBottom: '1.5rem', fontWeight: 600 }}>
                {q.question_text}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {q.options.map((option, optIdx) => {
                  const isSelected = selected === optIdx;
                  return (
                    <button key={optIdx} onClick={() => selectRetryAnswer(origIdx, optIdx)} style={{ textAlign: 'left', padding: '1.1rem 1.25rem', borderRadius: 'var(--radius-md)', border: isSelected ? '2px solid var(--primary-500)' : '1px solid var(--primary-200)', backgroundColor: isSelected ? 'var(--primary-100)' : '#ffffff', color: isSelected ? 'var(--primary-900)' : 'var(--neutral-700)', fontWeight: isSelected ? '600' : '400', boxShadow: isSelected ? 'var(--shadow-sm)' : 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: isSelected ? '6px solid var(--primary-500)' : '2px solid var(--primary-300)', backgroundColor: '#ffffff', flexShrink: 0 }} />
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const totalRetry = retryQuestionIndices.length;
              let retryStartIdx = 0;
              let retryEndIdx = totalRetry - 1;

              if (totalRetry > 5) {
                retryStartIdx = retryCurrentIdx - 2;
                retryEndIdx = retryCurrentIdx + 2;

                if (retryStartIdx < 0) {
                  retryStartIdx = 0;
                  retryEndIdx = 4;
                } else if (retryEndIdx >= totalRetry) {
                  retryEndIdx = totalRetry - 1;
                  retryStartIdx = totalRetry - 5;
                }
              }

              const visibleRetryIndices = [];
              for (let i = retryStartIdx; i <= retryEndIdx; i++) {
                visibleRetryIndices.push(i);
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                    <button
                      onClick={handleRetryPrev}
                      disabled={retryCurrentIdx === 0}
                      title="Quay lại"
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid var(--error-bg)', backgroundColor: '#ffffff',
                        color: 'var(--error)',
                        cursor: retryCurrentIdx === 0 ? 'not-allowed' : 'pointer',
                        opacity: retryCurrentIdx === 0 ? 0.5 : 1,
                        transition: 'var(--transition-smooth)', boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <ArrowLeft size={18} />
                    </button>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {visibleRetryIndices.map((i) => {
                        const origI = retryQuestionIndices[i];
                        const answered = retryAnswers[origI] !== undefined;
                        const isCurrent = retryCurrentIdx === i;
                        return (
                          <button
                            key={i}
                            onClick={() => { setRetryCurrentIdx(i); saveSession({ retry_current_idx: i }); }}
                            style={{
                              width: '36px', height: '36px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.9rem', fontWeight: 'bold',
                              border: isCurrent ? '2px solid var(--error)' : '1px solid #fca5a5',
                              backgroundColor: isCurrent ? '#fca5a5' : (answered ? '#fee2e2' : '#ffffff'),
                              color: 'var(--neutral-800)',
                              cursor: 'pointer', transition: 'var(--transition-smooth)'
                            }}
                          >
                            {origI + 1}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleRetryNext}
                      disabled={retryCurrentIdx === retryQuestionIndices.length - 1}
                      title="Tiếp tục"
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid #fca5a5', backgroundColor: '#ffffff',
                        color: 'var(--neutral-700)',
                        cursor: retryCurrentIdx === retryQuestionIndices.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: retryCurrentIdx === retryQuestionIndices.length - 1 ? 0.5 : 1,
                        transition: 'var(--transition-smooth)', boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>

                  {retryCurrentIdx === retryQuestionIndices.length - 1 && (
                    <button
                      onClick={handleSubmitRetry}
                      disabled={submitting}
                      className="btn btn-primary"
                      style={{
                        backgroundColor: 'var(--success)', color: '#ffffff',
                        padding: '0.6rem 1.5rem', fontSize: '0.95rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        boxShadow: 'var(--shadow-md)'
                      }}
                    >
                      {submitting ? 'Đang gửi...' : 'Nộp bài lần 2'} <Send size={16} />
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── 5. RESULT ── */}
      {step === 'result' && (
        <div className="glass-card card-body-pad" style={{ padding: '2.5rem' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .q-circle-retry:hover { transform: scale(1.12); box-shadow: 0 4px 14px rgba(239,68,68,0.35); }
          ` }} />

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: (retryResult ?? scoreResult).score >= 5.0 ? 'var(--success-bg)' : 'var(--error-bg)', borderRadius: '50%', color: (retryResult ?? scoreResult).score >= 5.0 ? 'var(--success)' : 'var(--error)', marginBottom: '1.25rem' }}>
              <Award size={48} />
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Kết Quả Bài Thu Hoạch</h2>
            <p style={{ color: 'var(--neutral-500)', fontSize: '0.95rem' }}>Thí sinh: <strong>{fullname}</strong> ({studentCode})</p>

            {submitError && (
              <div style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.5rem', alignItems: 'center', maxWidth: '500px', margin: '1rem auto 0', fontSize: '0.85rem', textAlign: 'left' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          {retryResult ? (
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', margin: '1.5rem 0' }}>
              {[{ label: 'Lần 1', result: scoreResult }, { label: 'Lần 2', result: retryResult }].map(({ label, result }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{label}</div>
                  <div style={{ width: '110px', height: '110px', borderRadius: '50%', border: `6px solid var(--primary-200)`, borderTopColor: result.score >= 5.0 ? 'var(--success)' : 'var(--primary-400)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-md)' }}>
                    <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1 }}>{result.score}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--neutral-500)', fontWeight: 600 }}>/ 10</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--neutral-500)', marginTop: '0.4rem' }}>{result.correctAnswers}/{result.totalQuestions} câu đúng</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
              <div style={{ margin: '0 auto', width: '150px', height: '150px', borderRadius: '50%', border: '8px solid var(--primary-200)', borderTopColor: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--primary-400)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-lg)' }}>
                <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1 }}>{scoreResult.score}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', fontWeight: 600, marginTop: '0.25rem' }}>Thang điểm 10</span>
              </div>
              <h3 style={{ color: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--primary-700)', marginTop: '1rem', marginBottom: '0.25rem', fontSize: '1.15rem' }}>
                {scoreResult.score >= 8.0
                  ? 'Xuất sắc! Bạn nắm kiến thức logistics rất tốt.'
                  : scoreResult.score >= 5.0
                    ? 'Đạt yêu cầu! Chúc mừng bạn đã hoàn thành bài thu hoạch.'
                    : 'Cần cố gắng thêm! Bạn nên ôn tập lại kiến thức.'}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--neutral-500)' }}>
                Trả lời đúng: <strong>{scoreResult.correctAnswers}</strong> / <strong>{scoreResult.totalQuestions}</strong> câu hỏi
              </p>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--primary-200)', margin: '1.5rem 0' }} />

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: '1rem' }}>
              {retryResult
                ? 'Kết quả từng câu hỏi'
                : wrongIndicesInResult.length > 0
                  ? 'Bấm vào câu đỏ để làm lại lần 2'
                  : 'Tất cả câu trả lời đúng!'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {questions.map((q, idx) => {
                const isCorrect = answers[idx] === q.correct_option_index;
                const wasRetried = retryQuestionIndices.includes(idx);
                const isRetryCorrect = wasRetried && retryAnswers[idx] === q.correct_option_index;

                let bgColor = '#f0fdf4';
                let borderColor = 'var(--success)';
                let iconColor = 'var(--success)';
                let isClickable = false;

                if (!isCorrect) {
                  if (retryResult) {
                    if (isRetryCorrect) {
                      bgColor = '#fffbeb'; borderColor = 'var(--primary-500)'; iconColor = 'var(--primary-600)';
                    } else {
                      bgColor = '#fef2f2'; borderColor = 'var(--error)'; iconColor = 'var(--error)';
                    }
                  } else {
                    bgColor = '#fef2f2'; borderColor = 'var(--error)'; iconColor = 'var(--error)';
                    isClickable = true;
                  }
                }

                return (
                  <div
                    key={idx}
                    className={isClickable ? 'q-circle-retry' : ''}
                    title={isClickable ? `Câu ${idx + 1} — Bấm để làm lại lần 2` : `Câu ${idx + 1}`}
                    onClick={() => isClickable && handleStartRetry()}
                    style={{
                      width: '68px', height: '68px', borderRadius: '50%',
                      backgroundColor: bgColor, border: `3px solid ${borderColor}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: isClickable ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    {isCorrect || isRetryCorrect
                      ? <CheckCircle2 size={22} style={{ color: iconColor }} />
                      : <AlertCircle size={22} style={{ color: iconColor }} />}
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: iconColor, marginTop: '0.15rem' }}>Câu {idx + 1}</span>
                  </div>
                );
              })}
            </div>

            {retryResult && (
              <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--neutral-500)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }} /> Đúng lần 1
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary-500)', display: 'inline-block' }} /> Đúng lần 2
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--error)', display: 'inline-block' }} /> Vẫn sai
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            {!retryResult && wrongIndicesInResult.length > 0 && (
              <button onClick={handleStartRetry} className="btn btn-primary" style={{ backgroundColor: 'var(--error)', color: '#ffffff' }}>
                <RotateCcw size={16} /> Làm lại {wrongIndicesInResult.length} câu sai
              </button>
            )}
            <button onClick={handleFullRetry} className="btn btn-outline">
              <RefreshCw size={16} /> Làm lại từ đầu
            </button>
          </div>
        </div>
      )}

      {/* ── SUBMIT WARNING MODAL ── */}
      {showSubmitModal && createPortal(
        <div
          onClick={() => setShowSubmitModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(28,25,23,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1200, animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass-card"
            style={{
              width: '90%', maxWidth: '480px', padding: '2rem',
              backgroundColor: '#ffffff', border: '1.5px solid var(--primary-300)',
              position: 'relative',
            }}
          >
            {(() => {
              const unansw = submitModalMode === 'quiz' ? unansweredIndices : unansweredRetryIndices;
              const hasUnanswered = unansw.length > 0;

              return (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                      display: 'inline-flex', padding: '0.85rem',
                      borderRadius: '50%', marginBottom: '0.85rem',
                      backgroundColor: hasUnanswered ? '#fffbeb' : 'var(--success-bg)',
                      color: hasUnanswered ? 'var(--primary-700)' : 'var(--success)',
                    }}>
                      {hasUnanswered ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>
                      {hasUnanswered ? 'Bạn chưa trả lời hết!' : 'Xác nhận nộp bài'}
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--neutral-500)' }}>
                      {hasUnanswered
                        ? `Còn ${unansw.length} câu chưa được chọn đáp án. Bấm vào số câu để điền trước khi nộp.`
                        : 'Bạn đã trả lời tất cả các câu hỏi. Xác nhận nộp bài?'}
                    </p>
                  </div>

                  {hasUnanswered && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                        Câu chưa trả lời — bấm để điền:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {unansw.map(idx => {
                          const displayNum = idx + 1;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setShowSubmitModal(false);
                                if (submitModalMode === 'quiz') {
                                  setCurrentIdx(idx);
                                } else {
                                  setRetryCurrentIdx(retryQuestionIndices.indexOf(idx));
                                }
                              }}
                              style={{
                                width: '44px', height: '44px', borderRadius: '50%',
                                border: '2px solid #f59e0b',
                                backgroundColor: '#fffbeb', color: '#92400e',
                                fontWeight: 700, fontSize: '0.95rem',
                                cursor: 'pointer', transition: 'var(--transition-smooth)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: 'var(--shadow-sm)',
                              }}
                              title={`Đi đến câu ${displayNum}`}
                            >
                              {displayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-outline"
                      onClick={() => setShowSubmitModal(false)}
                      style={{ fontSize: '0.875rem' }}
                    >
                      {hasUnanswered ? 'Quay lại điền tiếp' : 'Hủy'}
                    </button>
                    <button
                      onClick={handleConfirmSubmit}
                      disabled={submitting}
                      className="btn btn-primary"
                      style={{
                        backgroundColor: 'var(--success)', fontSize: '0.875rem',
                        opacity: submitting ? 0.7 : 1,
                      }}
                    >
                      <Send size={15} />
                      {submitting ? 'Đang nộp...' : hasUnanswered ? 'Nộp bài dù còn câu trống' : 'Xác nhận nộp bài'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* ── RESUME SESSION MODAL ── */}
      {showResumeModal && resumeData && createPortal(
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1200,
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '90%', maxWidth: '460px', padding: '2rem',
              backgroundColor: '#ffffff', border: '1.5px solid var(--primary-300)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                display: 'inline-flex', padding: '0.85rem', borderRadius: '50%',
                marginBottom: '0.85rem', backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-700)',
              }}>
                <PlayCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>Tiếp tục bài làm dở?</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--neutral-500)' }}>
                Hệ thống tìm thấy bài làm chưa hoàn thành của <strong>{resumeData.fullname || fullname}</strong>.
              </p>
            </div>

            {/* Session info */}
            <div style={{
              backgroundColor: 'var(--primary-50, #f0f9ff)', border: '1px solid var(--primary-200)',
              borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--neutral-500)' }}>Đã trả lời:</span>
                <strong style={{ color: 'var(--neutral-800)' }}>
                  {Object.keys(resumeData.answers_json || {}).length} / {questions.length} câu
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--neutral-500)' }}>Thời gian còn lại:</span>
                <strong style={{ color: resumeData.time_left < 60 ? 'var(--error)' : 'var(--primary-700)', fontFamily: 'monospace' }}>
                  {formatTime(resumeData.time_left || 0)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--neutral-500)' }}>Bắt đầu lúc:</span>
                <span style={{ color: 'var(--neutral-600)' }}>{formatDateTime(resumeData.started_at)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'stretch' }}>
              <button
                className="btn btn-outline"
                onClick={handleRestartSession}
                style={{ flex: 1, fontSize: '0.875rem' }}
              >
                <RefreshCw size={15} /> Làm lại từ đầu
              </button>
              <button
                onClick={handleResumeSession}
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.875rem' }}
              >
                <PlayCircle size={15} /> Tiếp tục làm bài
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
