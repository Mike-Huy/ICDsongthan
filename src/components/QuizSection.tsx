import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle2, AlertCircle, Clock, ArrowRight, ArrowLeft, Send, Award, RefreshCw, ClipboardCheck, RotateCcw } from 'lucide-react';
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

type Step = 'register' | 'testing' | 'result' | 'retry';

export default function QuizSection() {
  const [quiz, setQuiz] = useState<Quiz>(FALLBACK_QUIZ);
  const [questions, setQuestions] = useState<Question[]>(FALLBACK_QUESTIONS);
  const [isLoading, setIsLoading] = useState(true);

  const [fullname, setFullname] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [step, setStep] = useState<Step>('register');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [scoreResult, setScoreResult] = useState({ score: 0, correctAnswers: 0, totalQuestions: 0 });

  // Retry states
  const [retryQuestionIndices, setRetryQuestionIndices] = useState<number[]>([]);
  const [retryAnswers, setRetryAnswers] = useState<Record<number, number>>({});
  const [retryCurrentIdx, setRetryCurrentIdx] = useState(0);
  const [retryResult, setRetryResult] = useState<{ score: number; correctAnswers: number; totalQuestions: number } | null>(null);

  const timerRef = useRef<any>(null);
  // Updated every render so auto-submit always uses fresh state
  const submitQuizRef = useRef<() => void>(() => {});
  const submitRetryRef = useRef<() => void>(() => {});

  const loadQuiz = async () => {
    setIsLoading(true);
    try {
      const { data: quizData, error: quizError } = await supabase
        .from('onex_quizzes')
        .select('*')
        .order('id', { ascending: true })
        .limit(1);
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
        if (questionsData && questionsData.length > 0) setQuestions(questionsData);
        else setQuestions(FALLBACK_QUESTIONS);
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
    if (step === 'testing' || step === 'retry') {
      setTimeLeft(quiz.duration_minutes * 60);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            if (step === 'testing') submitQuizRef.current();
            else submitRetryRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullname || !studentCode || !email || !phone) return;
    setStep('testing');
    setCurrentIdx(0);
    setAnswers({});
  };

  const selectAnswer = (optionIndex: number) => {
    setAnswers({ ...answers, [currentIdx]: optionIndex });
  };

  const handleNext = () => { if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1); };
  const handlePrev = () => { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); };

  const handleSubmitQuiz = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
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
        fullname, student_code: studentCode, email, phone,
        quiz_id: quiz.id, score: results.score,
        total_questions: results.totalQuestions, correct_answers: results.correctAnswers,
        answers_json: finalAnswers,
      });
      if (error) throw error;
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
    setStep('result');
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
    setStep('retry');
  };

  const selectRetryAnswer = (origIdx: number, optIdx: number) => {
    setRetryAnswers({ ...retryAnswers, [origIdx]: optIdx });
  };

  const handleRetryNext = () => { if (retryCurrentIdx < retryQuestionIndices.length - 1) setRetryCurrentIdx(retryCurrentIdx + 1); };
  const handleRetryPrev = () => { if (retryCurrentIdx > 0) setRetryCurrentIdx(retryCurrentIdx - 1); };

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
      // NOTE: requires `attempt_number INTEGER DEFAULT 1` column in onex_submissions table
      const { error } = await supabase.from('onex_submissions').insert({
        fullname, student_code: studentCode, email, phone,
        quiz_id: quiz.id, score: results.score,
        total_questions: results.totalQuestions, correct_answers: results.correctAnswers,
        answers_json: finalAnswers,
        attempt_number: 2,
      });
      if (error) throw error;
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
    setStep('register');
    setAnswers({});
    setCurrentIdx(0);
    setRetryQuestionIndices([]);
    setRetryAnswers({});
    setRetryCurrentIdx(0);
    setRetryResult(null);
    setSubmitError('');
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
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

  // ── Derived values used in result view ───────────────────────────────────
  const wrongIndicesInResult = questions.reduce<number[]>((acc, q, idx) => {
    if (answers[idx] !== q.correct_option_index) acc.push(idx);
    return acc;
  }, []);

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* ── 1. REGISTER ── */}
      {step === 'register' && (
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'var(--primary-200)', borderRadius: '50%', color: 'var(--primary-800)', marginBottom: '1rem' }}>
              <ClipboardCheck size={36} />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{quiz.title}</h2>
            <p style={{ maxWidth: '600px', margin: '0 auto' }}>{quiz.description}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-primary">Số câu hỏi: {questions.length} câu</span>
              <span className="badge badge-primary"><Clock size={12} style={{ marginRight: '0.25rem' }} /> Thời gian: {quiz.duration_minutes} phút</span>
            </div>
          </div>
          <form onSubmit={handleRegister} style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Họ và tên học viên *</label>
              <input type="text" required className="form-input" placeholder="Nguyễn Văn A" value={fullname} onChange={(e) => setFullname(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Mã số học viên *</label>
              <input type="text" required className="form-input" placeholder="ONEX-2026-XXXX" value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Địa chỉ Email *</label>
              <input type="email" required className="form-input" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Số điện thoại *</label>
              <input type="tel" required className="form-input" placeholder="0901234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.05rem', padding: '0.85rem' }}>
              Bắt đầu làm bài thu hoạch <ArrowRight size={18} />
            </button>
          </form>
        </div>
      )}

      {/* ── 2. TESTING ── */}
      {step === 'testing' && (
        <div>
          <div className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--primary-200)' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Thí sinh:</span>
              <strong style={{ marginLeft: '0.25rem', color: 'var(--neutral-800)' }}>{fullname}</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-400)', marginLeft: '0.5rem' }}>({studentCode})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: timeLeft < 60 ? 'var(--error-bg)' : 'var(--primary-200)', color: timeLeft < 60 ? 'var(--error)' : 'var(--primary-800)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }}>
              <Clock size={16} />
              <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--neutral-200)', height: '8px', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--primary-500)', height: '100%', width: `${(Object.keys(answers).length / questions.length) * 100}%`, transition: 'var(--transition-smooth)' }} />
          </div>

          <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span className="badge badge-primary">Câu {currentIdx + 1} / {questions.length}</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Điểm: {questions[currentIdx].score}đ</span>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={handlePrev} disabled={currentIdx === 0} className="btn btn-outline" style={{ opacity: currentIdx === 0 ? 0.5 : 1, cursor: currentIdx === 0 ? 'not-allowed' : 'pointer' }}>
              <ArrowLeft size={16} /> Câu trước
            </button>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0 1rem' }}>
              {questions.map((_, idx) => {
                const isAnswered = answers[idx] !== undefined;
                const isCurrent = currentIdx === idx;
                return (
                  <button key={idx} onClick={() => setCurrentIdx(idx)} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', border: isCurrent ? '2px solid var(--neutral-800)' : '1px solid var(--primary-300)', backgroundColor: isCurrent ? 'var(--primary-300)' : (isAnswered ? 'var(--primary-200)' : '#ffffff'), color: isCurrent ? 'var(--neutral-900)' : 'var(--neutral-700)' }}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            {currentIdx < questions.length - 1 ? (
              <button onClick={handleNext} className="btn btn-secondary">Câu tiếp theo <ArrowRight size={16} /></button>
            ) : (
              <button onClick={handleSubmitQuiz} disabled={submitting} className="btn btn-primary" style={{ backgroundColor: 'var(--success)', color: '#ffffff' }}>
                {submitting ? 'Đang gửi...' : 'Nộp bài'} <Send size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 3. RETRY ── */}
      {step === 'retry' && retryQuestionIndices.length > 0 && (() => {
        const origIdx = retryQuestionIndices[retryCurrentIdx];
        const q = questions[origIdx];
        const selected = retryAnswers[origIdx];
        return (
          <div>
            <div className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '2px solid var(--error-bg)' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Làm lại — Lần 2</span>
                <div style={{ fontSize: '0.875rem', color: 'var(--neutral-600)', marginTop: '0.1rem' }}>
                  {fullname} <span style={{ color: 'var(--neutral-400)' }}>({studentCode})</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: timeLeft < 60 ? 'var(--error-bg)' : 'var(--primary-200)', color: timeLeft < 60 ? 'var(--error)' : 'var(--primary-800)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }}>
                <Clock size={16} />
                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{formatTime(timeLeft)}</span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--neutral-200)', height: '8px', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
              <div style={{ backgroundColor: 'var(--error)', height: '100%', width: `${(Object.keys(retryAnswers).length / retryQuestionIndices.length) * 100}%`, transition: 'var(--transition-smooth)' }} />
            </div>

            <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '1.5rem', borderTop: '4px solid var(--error)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span className="badge" style={{ backgroundColor: '#fef2f2', color: 'var(--error)', border: '1px solid var(--error)' }}>
                  Câu sai {retryCurrentIdx + 1} / {retryQuestionIndices.length}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Câu gốc số {origIdx + 1} — {q.score}đ</span>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={handleRetryPrev} disabled={retryCurrentIdx === 0} className="btn btn-outline" style={{ opacity: retryCurrentIdx === 0 ? 0.5 : 1, cursor: retryCurrentIdx === 0 ? 'not-allowed' : 'pointer' }}>
                <ArrowLeft size={16} /> Câu trước
              </button>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {retryQuestionIndices.map((origI, i) => {
                  const answered = retryAnswers[origI] !== undefined;
                  const isCurrent = retryCurrentIdx === i;
                  return (
                    <button key={i} onClick={() => setRetryCurrentIdx(i)} style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', border: isCurrent ? '2px solid var(--error)' : '1px solid #fca5a5', backgroundColor: isCurrent ? '#fca5a5' : (answered ? '#fee2e2' : '#ffffff'), color: 'var(--neutral-800)' }}>
                      {origI + 1}
                    </button>
                  );
                })}
              </div>

              {retryCurrentIdx < retryQuestionIndices.length - 1 ? (
                <button onClick={handleRetryNext} className="btn btn-secondary">Câu tiếp theo <ArrowRight size={16} /></button>
              ) : (
                <button onClick={handleSubmitRetry} disabled={submitting} className="btn btn-primary" style={{ backgroundColor: 'var(--success)', color: '#ffffff' }}>
                  {submitting ? 'Đang gửi...' : 'Nộp lần 2'} <Send size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── 4. RESULT ── */}
      {step === 'result' && (
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .q-circle-retry:hover { transform: scale(1.12); box-shadow: 0 4px 14px rgba(239,68,68,0.35); }
          ` }} />

          {/* Header */}
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

          {/* Score display — single or dual */}
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

          {/* Question status grid */}
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
                    // After retry: amber = improved, red = still wrong
                    if (isRetryCorrect) {
                      bgColor = '#fffbeb'; borderColor = 'var(--primary-500)'; iconColor = 'var(--primary-600)';
                    } else {
                      bgColor = '#fef2f2'; borderColor = 'var(--error)'; iconColor = 'var(--error)';
                    }
                  } else {
                    // Before retry: red, clickable
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
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      backgroundColor: bgColor,
                      border: `3px solid ${borderColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
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

            {/* Legend after retry */}
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

          {/* Action buttons */}
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
    </div>
  );
}
