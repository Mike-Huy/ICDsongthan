import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Star, Send, CheckCircle, Clipboard } from 'lucide-react';

interface EvaluationQuestion {
  id: string | number;
  question_text: string;
  question_type: 'rating' | 'text' | 'choice';
  options?: string[] | null;
}

const FALLBACK_EVALUATIONS: EvaluationQuestion[] = [
  {
    id: 1,
    question_text: 'Nội dung chương trình học hữu ích và thực tế với công việc Logistics.',
    question_type: 'rating'
  },
  {
    id: 2,
    question_text: 'Giảng viên có kiến thức chuyên sâu và truyền đạt dễ hiểu.',
    question_type: 'rating'
  },
  {
    id: 3,
    question_text: 'Cơ sở vật chất, tài liệu học tập và thời lượng khóa học được sắp xếp hợp lý.',
    question_type: 'rating'
  },
  {
    id: 4,
    question_text: 'Mức độ hài lòng chung của bạn về chương trình đào tạo ONEX Training?',
    question_type: 'rating'
  },
  {
    id: 5,
    question_text: 'Bạn có đề xuất gì để cải tiến chương trình học tốt hơn trong tương lai?',
    question_type: 'text'
  }
];

export default function EvaluationSection() {
  const [evalQuestions, setEvalQuestions] = useState<EvaluationQuestion[]>(FALLBACK_EVALUATIONS);
  const [isLoading, setIsLoading] = useState(true);

  // Student info
  const [fullname, setFullname] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Form flow: 'register' | 'survey' | 'submitted'
  const [step, setStep] = useState<'register' | 'survey' | 'submitted'>('register');
  const [answers, setAnswers] = useState<Record<string | number, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadEvaluations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('onex_evaluations')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setEvalQuestions(data);
      } else {
        setEvalQuestions(FALLBACK_EVALUATIONS);
      }
    } catch (err) {
      console.warn("Failed to load evaluations from Supabase. Falling back to default survey:", err);
      setEvalQuestions(FALLBACK_EVALUATIONS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluations();
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname || !studentCode) return;
    setStep('survey');
    
    // Initialize empty answers
    const initialAnswers: Record<string | number, any> = {};
    evalQuestions.forEach(q => {
      initialAnswers[q.id] = q.question_type === 'rating' ? 5 : '';
    });
    setAnswers(initialAnswers);
  };

  const handleRatingChange = (questionId: string | number, rating: number) => {
    setAnswers({
      ...answers,
      [questionId]: rating
    });
  };

  const handleTextChange = (questionId: string | number, text: string) => {
    setAnswers({
      ...answers,
      [questionId]: text
    });
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      // Map evaluation answers to JSON
      const formattedAnswers: Record<string, any> = {};
      evalQuestions.forEach(q => {
        formattedAnswers[String(q.id)] = answers[q.id];
      });

      const { error } = await supabase
        .from('onex_evaluation_submissions')
        .insert({
          fullname,
          student_code: studentCode,
          email,
          phone,
          answers: formattedAnswers
        });

      if (error) throw error;
      setStep('submitted');
    } catch (err: any) {
      console.error("Error submitting evaluation:", err);
      setSubmitError('Có lỗi xảy ra khi gửi đánh giá của bạn. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-200)', borderTopColor: 'var(--primary-500)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p>Đang tải câu hỏi đánh giá khóa học...</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {/* 1. REGISTRATION FORM */}
      {step === 'register' && (
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'var(--primary-200)', borderRadius: '50%', color: 'var(--primary-800)', marginBottom: '1rem' }}>
              <Clipboard size={36} />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Đánh Giá Khóa Học Logistics</h2>
            <p style={{ maxWidth: '600px', margin: '0 auto' }}>
              Ý kiến của bạn sẽ giúp ONEX Training nâng cao chất lượng bài giảng, chương trình đào tạo và dịch vụ hỗ trợ học viên tốt hơn.
            </p>
          </div>

          <form onSubmit={handleRegister} style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Họ và tên nhân viên *</label>
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
              <label className="form-label">Mã nhân viên ICD *</label>
              <input 
                type="text" 
                required 
                className="form-input" 
                placeholder="ONEX-2026-XXXX" 
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.05rem', padding: '0.85rem' }}>
              Tiến hành đánh giá <Send size={16} />
            </button>
          </form>
        </div>
      )}

      {/* 2. SURVEY INTERFACE */}
      {step === 'survey' && (
        <form onSubmit={handleSubmitSurvey} className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--primary-200)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Khảo Sát Ý Kiến Nhân Viên</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--neutral-500)' }}>Nhân viên: <strong>{fullname}</strong> ({studentCode})</p>
          </div>

          {submitError && (
            <div style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {evalQuestions.map((q, idx) => {
              return (
                <div key={q.id} style={{ borderBottom: idx < evalQuestions.length - 1 ? '1px dashed var(--primary-200)' : 'none', paddingBottom: '1.5rem' }}>
                  <p style={{ fontWeight: 600, color: 'var(--neutral-800)', marginBottom: '1rem', fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
                    {idx + 1}. {(() => {
                      const lines = q.question_text.split('\n').map(l => l.trim()).filter(Boolean);
                      const optionLines = lines.slice(1).filter(line => line.startsWith('-') || line.startsWith('*') || line.startsWith('•'));
                      return optionLines.length > 0 ? lines[0] : q.question_text;
                    })()}
                  </p>

                  {/* Rating Type */}
                  {q.question_type === 'rating' && (
                    <div className="star-row" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const active = star <= (answers[q.id] || 0);
                        return (
                          <button
                            type="button"
                            key={star}
                            onClick={() => handleRatingChange(q.id, star)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: active ? 'var(--primary-500)' : 'var(--neutral-300)',
                              transition: 'var(--transition-smooth)',
                            }}
                          >
                            <Star size={32} fill={active ? 'var(--primary-500)' : 'none'} style={{ cursor: 'pointer' }} />
                          </button>
                        );
                      })}
                      <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-800)' }}>
                        {answers[q.id] === 5 && 'Rất hài lòng (5/5)'}
                        {answers[q.id] === 4 && 'Hài lòng (4/5)'}
                        {answers[q.id] === 3 && 'Bình thường (3/5)'}
                        {answers[q.id] === 2 && 'Không hài lòng (2/5)'}
                        {answers[q.id] === 1 && 'Rất không hài lòng (1/5)'}
                      </span>
                    </div>
                  )}

                  {/* Text Type */}
                  {q.question_type === 'text' && (() => {
                    const lines = q.question_text.split('\n').map(l => l.trim()).filter(Boolean);
                    const optionLines = lines.slice(1).filter(line => line.startsWith('-') || line.startsWith('*') || line.startsWith('•'));
                    const hasOptions = optionLines.length > 0;

                    if (!hasOptions) {
                      return (
                        <textarea
                          className="form-input"
                          rows={4}
                          placeholder="Ý kiến hoặc đóng góp thêm của bạn..."
                          value={answers[q.id] || ''}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          style={{ resize: 'vertical' }}
                        />
                      );
                    }

                    // Parse options
                    const options = optionLines.map(line => line.replace(/^[-*•]\s*/, '').trim());
                    const currentAnswer = String(answers[q.id] || '');
                    const selectedParts = currentAnswer.includes(';;') 
                      ? currentAnswer.split(';; ').map(s => s.trim()).filter(Boolean)
                      : currentAnswer.split(', ').map(s => s.trim()).filter(Boolean);

                    // Find if there's a "Khác" option using robust whole-word check
                    const isOtherOption = (opt: string) => {
                      const normalized = opt.trim().toLowerCase();
                      return normalized === 'khác' || 
                             normalized.startsWith('khác ') || 
                             normalized.endsWith(' khác') || 
                             normalized.includes(' khác ');
                    };
                    const otherOptionText = options.find(isOtherOption);
                    
                    const handleCheckboxChange = (topic: string, checked: boolean) => {
                      let newParts = selectedParts.filter(p => p !== topic && !p.startsWith('Khác: ') && !p.startsWith(`${otherOptionText}: `));
                      if (checked) {
                        newParts.push(topic);
                      }
                      
                      // Keep any other custom text if it was set
                      const otherPart = selectedParts.find(p => p.startsWith('Khác: ') || (otherOptionText && p.startsWith(`${otherOptionText}: `)));
                      if (otherPart) {
                        newParts.push(otherPart);
                      }
                      handleTextChange(q.id, newParts.join(';; '));
                    };

                    const handleOtherCheckboxChange = (checked: boolean) => {
                      let newParts = selectedParts.filter(p => p !== 'Khác' && !p.startsWith('Khác: ') && !(otherOptionText && (p === otherOptionText || p.startsWith(`${otherOptionText}: `))));
                      if (checked) {
                        const currentOtherText = otherOptionText ? (selectedParts.find(p => p.startsWith(`${otherOptionText}: `))?.replace(new RegExp(`^${otherOptionText}:\\s*`), '') || '') : '';
                        const defaultLabel = otherOptionText || 'Khác';
                        newParts.push(currentOtherText ? `${defaultLabel}: ${currentOtherText}` : defaultLabel);
                      }
                      handleTextChange(q.id, newParts.join(';; '));
                    };

                    const handleOtherTextChange = (text: string) => {
                      const defaultLabel = otherOptionText || 'Khác';
                      let newParts = selectedParts.filter(p => p !== defaultLabel && !p.startsWith(`${defaultLabel}: `));
                      if (text) {
                        newParts.push(`${defaultLabel}: ${text}`);
                      } else {
                        // If text is empty but checkbox is still checked
                        newParts.push(defaultLabel);
                      }
                      handleTextChange(q.id, newParts.join(';; '));
                    };

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {options.map(topic => {
                          const isOther = otherOptionText && topic === otherOptionText;
                          if (isOther) return null; // Render other option separately at the bottom

                          const isSelected = selectedParts.includes(topic);
                          return (
                            <label
                              key={topic}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.75rem',
                                cursor: 'pointer',
                                padding: '1rem 1.25rem',
                                borderRadius: 'var(--radius-md)',
                                border: isSelected ? '2px solid var(--primary-400)' : '1px solid var(--neutral-200)',
                                backgroundColor: isSelected ? '#fffbeb' : 'white',
                                fontSize: '0.95rem',
                                color: isSelected ? 'var(--neutral-800)' : 'var(--neutral-600)',
                                fontWeight: isSelected ? 600 : 400,
                                transition: 'var(--transition-smooth)',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => handleCheckboxChange(topic, e.target.checked)}
                                style={{ accentColor: 'var(--primary-500)', marginTop: '0.2rem' }}
                              />
                              <span style={{ lineHeight: '1.4' }}>{topic}</span>
                            </label>
                          );
                        })}
                        
                        {otherOptionText && (() => {
                          const defaultLabel = otherOptionText;
                          const otherPart = selectedParts.find(p => p === defaultLabel || p.startsWith(`${defaultLabel}: `));
                          const isOtherChecked = !!otherPart;
                          const otherText = otherPart ? otherPart.replace(new RegExp(`^${defaultLabel}:\\s*`), '') : '';

                          return (
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              gap: '0.6rem', 
                              padding: '1rem 1.25rem', 
                              borderRadius: 'var(--radius-md)', 
                              border: isOtherChecked ? '2px solid var(--primary-400)' : '1px solid var(--neutral-200)', 
                              backgroundColor: isOtherChecked ? '#fffbeb' : 'white',
                              marginTop: '0.5rem',
                              transition: 'var(--transition-smooth)',
                            }}>
                              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={isOtherChecked}
                                  onChange={(e) => handleOtherCheckboxChange(e.target.checked)}
                                  style={{ accentColor: 'var(--primary-500)', marginTop: '0.2rem' }}
                                />
                                <span style={{ fontSize: '0.95rem', color: isOtherChecked ? 'var(--neutral-800)' : 'var(--neutral-600)', fontWeight: isOtherChecked ? 600 : 400 }}>
                                  {defaultLabel}
                                </span>
                              </label>
                              
                              {isOtherChecked && (
                                <div style={{ paddingLeft: '1.75rem', marginTop: '0.25rem' }} className="fade-in">
                                  <textarea
                                    placeholder="Vui lòng nhập thông tin chi tiết..."
                                    rows={3}
                                    value={otherText === defaultLabel ? '' : otherText}
                                    onChange={(e) => handleOtherTextChange(e.target.value)}
                                    style={{
                                      border: '1px solid var(--neutral-300)',
                                      borderRadius: 'var(--radius-sm)',
                                      outline: 'none',
                                      backgroundColor: 'white',
                                      fontSize: '0.95rem',
                                      padding: '0.5rem 0.75rem',
                                      width: '100%',
                                      color: 'var(--neutral-800)',
                                      fontWeight: 500,
                                      resize: 'vertical',
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Choice Type */}
                  {q.question_type === 'choice' && q.options && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {q.options.map((option, oIdx) => {
                        const isChecked = answers[q.id] === option;
                        return (
                          <label key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`choice-${q.id}`}
                              checked={isChecked}
                              onChange={() => handleTextChange(q.id, option)}
                              style={{ accentColor: 'var(--primary-500)' }}
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem', borderTop: '1px solid var(--primary-200)', paddingTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setStep('register')}
              disabled={submitting}
            >
              Quay lại
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Đang gửi...' : 'Gửi đánh giá'} <Send size={16} />
            </button>
          </div>
        </form>
      )}

      {/* 3. SUBMITTED SUCCESS CARD */}
      {step === 'submitted' && (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: 'var(--success-bg)', borderRadius: '50%', color: 'var(--success)', marginBottom: '1.5rem' }}>
            <CheckCircle size={48} />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Gửi Đánh Giá Thành Công!</h2>
          <p style={{ maxWidth: '500px', margin: '0 auto 2rem', color: 'var(--neutral-600)' }}>
            Cảm ơn nhân viên <strong>{fullname}</strong> đã dành thời gian đóng góp ý kiến. Những phản hồi quý báu của bạn sẽ giúp khóa học ONEX Training ngày càng hoàn thiện hơn.
          </p>
          <button
            onClick={() => {
              setStep('register');
              setFullname('');
              setStudentCode('');
              setEmail('');
              setPhone('');
            }}
            className="btn btn-primary"
          >
            Làm đánh giá mới
          </button>
        </div>
      )}

    </div>
  );
}
