import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle2, AlertCircle, Clock, ArrowRight, ArrowLeft, Send, Award, RefreshCw, ClipboardCheck } from 'lucide-react';
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

// Fallback questions to ensure app is fully functional even if SQL seed is not yet run
const FALLBACK_QUIZ: Quiz = {
  id: 1,
  title: 'Bài Thu Hoạch Kiến Thức Logistics Cơ Bản',
  description: 'Bài trắc nghiệm đánh giá kiến thức cơ bản về chuỗi cung ứng, vận tải, và quản trị kho bãi dành cho học viên chương trình đào tạo ONEX Logistics.',
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

export default function QuizSection() {
  // Quiz states
  const [quiz, setQuiz] = useState<Quiz>(FALLBACK_QUIZ);
  const [questions, setQuestions] = useState<Question[]>(FALLBACK_QUESTIONS);
  const [isLoading, setIsLoading] = useState(true);

  // User details state
  const [fullname, setFullname] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // App flow states: 'register' | 'testing' | 'result'
  const [step, setStep] = useState<'register' | 'testing' | 'result'>('register');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // questionIndex -> optionIndex
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  // Completed test results
  const [scoreResult, setScoreResult] = useState({
    score: 0,
    correctAnswers: 0,
    totalQuestions: 0,
  });

  const timerRef = useRef<any>(null);

  // Fetch active quiz and questions
  const loadQuiz = async () => {
    setIsLoading(true);
    try {
      // Fetch the first quiz
      const { data: quizData, error: quizError } = await supabase
        .from('onex_quizzes')
        .select('*')
        .order('id', { ascending: true })
        .limit(1);

      if (quizError) throw quizError;

      if (quizData && quizData.length > 0) {
        const activeQuiz = quizData[0];
        setQuiz(activeQuiz);

        // Fetch questions for this quiz
        const { data: questionsData, error: questionsError } = await supabase
          .from('onex_questions')
          .select('*')
          .eq('quiz_id', activeQuiz.id)
          .order('id', { ascending: true });

        if (questionsError) throw questionsError;

        if (questionsData && questionsData.length > 0) {
          setQuestions(questionsData);
        } else {
          setQuestions(FALLBACK_QUESTIONS);
        }
      } else {
        setQuiz(FALLBACK_QUIZ);
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch (err) {
      console.warn("Failed to load quiz from Supabase. Falling back to offline questions:", err);
      setQuiz(FALLBACK_QUIZ);
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuiz();
  }, []);

  // Timer logic
  useEffect(() => {
    if (step === 'testing') {
      setTimeLeft(quiz.duration_minutes * 60);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname || !studentCode || !email || !phone) return;
    setStep('testing');
    setCurrentIdx(0);
    setAnswers({});
  };

  const selectAnswer = (optionIndex: number) => {
    setAnswers({
      ...answers,
      [currentIdx]: optionIndex
    });
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  // Calculate score locally
  const calculateScore = () => {
    let totalScore = 0;
    let correct = 0;
    let maxPossibleScore = 0;

    questions.forEach((q, idx) => {
      maxPossibleScore += q.score;
      if (answers[idx] === q.correct_option_index) {
        totalScore += q.score;
        correct += 1;
      }
    });

    // Scale score to 10-point system
    const scaledScore = parseFloat(((totalScore / maxPossibleScore) * 10).toFixed(1));
    return {
      score: scaledScore,
      correctAnswers: correct,
      totalQuestions: questions.length
    };
  };

  const handleSubmitQuiz = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);
    setSubmitError('');

    const results = calculateScore();

    try {
      // Map questions and answers to format
      const finalAnswers: Record<string, number> = {};
      questions.forEach((q, idx) => {
        finalAnswers[String(q.id)] = answers[idx] !== undefined ? answers[idx] : -1;
      });

      // Submit to Supabase
      const { error } = await supabase
        .from('onex_submissions')
        .insert({
          fullname,
          student_code: studentCode,
          email,
          phone,
          quiz_id: quiz.id,
          score: results.score,
          total_questions: results.totalQuestions,
          correct_answers: results.correctAnswers,
          answers_json: finalAnswers,
        });

      if (error) throw error;

      // Confetti effect for passing (>= 5.0)
      if (results.score >= 5.0) {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#fbbf24', '#f59e0b', '#d97706', '#10b981']
        });
      }

      setScoreResult(results);
      setStep('result');
    } catch (err: any) {
      console.error("Error submitting quiz results:", err);
      setSubmitError('Không thể gửi kết quả thi lên hệ thống. Vui lòng kiểm tra lại kết nối hoặc liên hệ admin.');
      
      // Still show the result screen so user doesn't lose their session
      setScoreResult(results);
      setStep('result');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    handleSubmitQuiz();
  };

  const handleRetry = () => {
    setStep('register');
    setAnswers({});
    setCurrentIdx(0);
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
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {/* 1. REGISTRATION STEP */}
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
              <span className="badge badge-primary">
                <Clock size={12} style={{ marginRight: '0.25rem' }} /> Thời gian: {quiz.duration_minutes} phút
              </span>
            </div>
          </div>

          <form onSubmit={handleRegister} style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Họ và tên học viên *</label>
              <input 
                type="text" 
                required 
                className="form-input" 
                placeholder="Nguyễn Văn A" 
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mã số học viên *</label>
              <input 
                type="text" 
                required 
                className="form-input" 
                placeholder="ONEX-2026-XXXX" 
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Địa chỉ Email *</label>
              <input 
                type="email" 
                required 
                className="form-input" 
                placeholder="email@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Số điện thoại *</label>
              <input 
                type="tel" 
                required 
                className="form-input" 
                placeholder="0901234567" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.05rem', padding: '0.85rem' }}>
              Bắt đầu làm bài thu hoạch <ArrowRight size={18} />
            </button>
          </form>
        </div>
      )}

      {/* 2. TESTING STEP */}
      {step === 'testing' && (
        <div>
          {/* Header Panel */}
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

          {/* Progress bar */}
          <div style={{ backgroundColor: 'var(--neutral-200)', height: '8px', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
            <div style={{ 
              backgroundColor: 'var(--primary-500)', 
              height: '100%', 
              width: `${((Object.keys(answers).length) / questions.length) * 100}%`,
              transition: 'var(--transition-smooth)'
            }} />
          </div>

          {/* Main Question Card */}
          <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <span className="badge badge-primary">Câu {currentIdx + 1} / {questions.length}</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Điểm: {questions[currentIdx].score}đ</span>
            </div>

            <h3 style={{ fontSize: '1.35rem', color: 'var(--neutral-800)', marginBottom: '1.5rem', fontWeight: 600 }}>
              {questions[currentIdx].question_text}
            </h3>

            {/* Answer Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {questions[currentIdx].options.map((option, optIdx) => {
                const isSelected = answers[currentIdx] === optIdx;
                return (
                  <button
                    key={optIdx}
                    onClick={() => selectAnswer(optIdx)}
                    style={{
                      textAlign: 'left',
                      padding: '1.1rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary-500)' : '1px solid var(--primary-200)',
                      backgroundColor: isSelected ? 'var(--primary-100)' : '#ffffff',
                      color: isSelected ? 'var(--primary-900)' : 'var(--neutral-700)',
                      fontWeight: isSelected ? '600' : '400',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: isSelected ? '6px solid var(--primary-500)' : '2px solid var(--primary-300)',
                      backgroundColor: '#ffffff',
                      flexShrink: 0
                    }} />
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              onClick={handlePrev} 
              disabled={currentIdx === 0}
              className="btn btn-outline"
              style={{ opacity: currentIdx === 0 ? 0.5 : 1, cursor: currentIdx === 0 ? 'not-allowed' : 'pointer' }}
            >
              <ArrowLeft size={16} /> Câu trước
            </button>

            {/* Questions Grid Panel (small navigation circles) */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0 1rem' }}>
              {questions.map((_, idx) => {
                const isAnswered = answers[idx] !== undefined;
                const isCurrent = currentIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIdx(idx)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      border: isCurrent ? '2px solid var(--neutral-800)' : '1px solid var(--primary-300)',
                      backgroundColor: isCurrent ? 'var(--primary-300)' : (isAnswered ? 'var(--primary-200)' : '#ffffff'),
                      color: isCurrent ? 'var(--neutral-900)' : 'var(--neutral-700)',
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {currentIdx < questions.length - 1 ? (
              <button onClick={handleNext} className="btn btn-secondary">
                Câu tiếp theo <ArrowRight size={16} />
              </button>
            ) : (
              <button 
                onClick={handleSubmitQuiz} 
                disabled={submitting} 
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--success)', color: '#ffffff' }}
              >
                {submitting ? 'Đang gửi...' : 'Nộp bài'} <Send size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. RESULT STEP */}
      {step === 'result' && (
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: scoreResult.score >= 5.0 ? 'var(--success-bg)' : 'var(--error-bg)', borderRadius: '50%', color: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--error)', marginBottom: '1.25rem' }}>
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

            {/* Score circle */}
            <div style={{ margin: '2rem auto', width: '150px', height: '150px', borderRadius: '50%', border: '8px solid var(--primary-200)', borderTopColor: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--primary-400)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-lg)' }}>
              <span style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--neutral-800)', lineHeight: 1 }}>{scoreResult.score}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', fontWeight: 600, marginTop: '0.25rem' }}>Thang điểm 10</span>
            </div>

            <h3 style={{ color: scoreResult.score >= 5.0 ? 'var(--success)' : 'var(--primary-700)', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
              {scoreResult.score >= 8.0 
                ? 'Xuất sắc! Bạn nắm kiến thức logistics rất tốt.' 
                : scoreResult.score >= 5.0 
                  ? 'Đạt yêu cầu! Chúc mừng bạn đã hoàn thành bài thu hoạch.' 
                  : 'Cần cố gắng thêm! Bạn nên ôn tập lại kiến thức.'}
            </h3>
            
            <p style={{ fontSize: '0.95rem' }}>
              Trả lời đúng: <strong>{scoreResult.correctAnswers}</strong> trên tổng số <strong>{scoreResult.totalQuestions}</strong> câu hỏi.
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--primary-200)', margin: '2rem 0' }} />

          {/* Detailed Question Review */}
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--neutral-800)', fontWeight: 'bold' }}>Chi tiết các câu hỏi:</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {questions.map((q, idx) => {
                const selectedOpt = answers[idx];
                const correctOpt = q.correct_option_index;
                const isCorrect = selectedOpt === correctOpt;

                return (
                  <div key={idx} style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-200)', backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      {isCorrect ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.15rem' }} />
                      ) : (
                        <AlertCircle size={18} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '0.15rem' }} />
                      )}
                      <div>
                        <strong style={{ color: 'var(--neutral-800)', fontSize: '0.95rem' }}>Câu {idx + 1}: {q.question_text}</strong>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '1.6rem' }}>
                      <div>
                        <span style={{ color: 'var(--neutral-500)' }}>Lựa chọn của bạn:</span>{' '}
                        <span style={{ color: isCorrect ? 'var(--success)' : 'var(--error)', fontWeight: 'bold' }}>
                          {selectedOpt !== undefined ? q.options[selectedOpt] : 'Không trả lời'}
                        </span>
                      </div>
                      {!isCorrect && (
                        <div>
                          <span style={{ color: 'var(--neutral-500)' }}>Đáp án chính xác:</span>{' '}
                          <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                            {q.options[correctOpt]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem', gap: '1rem' }}>
            <button onClick={handleRetry} className="btn btn-primary">
              <RefreshCw size={16} /> Làm lại bài thi
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
