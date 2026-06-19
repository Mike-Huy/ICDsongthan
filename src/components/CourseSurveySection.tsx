import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ClipboardList, Send, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';

interface Course {
  id: number;
  course_code: string;
  name: string;
  description: string | null;
}

const TRAINING_TOPICS = [
  'Quản lý kho hàng nâng cao',
  'Vận tải và logistics quốc tế',
  'Hải quan và xuất nhập khẩu',
  'Quản lý chuỗi cung ứng',
  'Chuyển đổi số trong logistics',
  'Ứng dụng AI trong logistics',
  'Kỹ năng quản lý và lãnh đạo',
  'An toàn lao động kho bãi',
  'Phần mềm quản lý kho (WMS)',
  'Tiếng Anh chuyên ngành logistics',
];

interface Props {
  courseCode: string;
}

export default function CourseSurveySection({ courseCode }: Props) {
  const [course, setCourse] = useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState('');

  const [fullname, setFullname] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');

  const [step, setStep] = useState<'register' | 'survey' | 'submitted'>('register');
  const [hvCode, setHvCode] = useState('');

  const [answers, setAnswers] = useState<{
    q1: string;
    q2: string[];
    q3: number;
    q4: string;
    q5: string;
    q6: string;
    q7: string[];
    q8: string;
  }>({
    q1: '',
    q2: ['', '', ''],
    q3: 0,
    q4: '',
    q5: '',
    q6: '',
    q7: [],
    q8: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!courseCode) {
      setCourseError('Không tìm thấy mã khóa học. Vui lòng quét lại QR code.');
      setCourseLoading(false);
      return;
    }
    loadCourse();
  }, [courseCode]);

  const loadCourse = async () => {
    setCourseLoading(true);
    try {
      const { data, error } = await supabase
        .from('onex_courses')
        .select('*')
        .eq('course_code', courseCode)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setCourseError(`Không tìm thấy khóa học với mã "${courseCode}". Vui lòng liên hệ ban tổ chức.`);
      } else {
        setCourse(data);
      }
    } catch (err: any) {
      setCourseError(`Lỗi tải thông tin khóa học: ${err.message}`);
    } finally {
      setCourseLoading(false);
    }
  };

  const generateHvCode = async (): Promise<string> => {
    const { data } = await supabase
      .from('onex_course_survey_responses')
      .select('hv_code')
      .order('id', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
      const match = data[0].hv_code?.match(/hv_(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `hv_${String(nextNum).padStart(5, '0')}`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname.trim() || !employeeCode.trim()) return;
    const code = await generateHvCode();
    setHvCode(code);
    setStep('survey');
  };

  const handleTopicToggle = (topic: string) => {
    const current = answers.q7;
    setAnswers({
      ...answers,
      q7: current.includes(topic) ? current.filter(t => t !== topic) : [...current, topic],
    });
  };

  const handleKeywordChange = (index: number, value: string) => {
    const kws = [...answers.q2];
    kws[index] = value;
    setAnswers({ ...answers, q2: kws });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;

    if (!answers.q1.trim()) {
      setSubmitError('Vui lòng trả lời câu hỏi số 1.');
      return;
    }
    if (!answers.q6) {
      setSubmitError('Vui lòng trả lời câu hỏi số 6 (cho phép sử dụng hình ảnh).');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const { error } = await supabase
        .from('onex_course_survey_responses')
        .insert({
          course_id: course.id,
          course_code: course.course_code,
          fullname: fullname.trim(),
          employee_code: employeeCode.trim(),
          hv_code: hvCode,
          answers: {
            q1: answers.q1,
            q2: answers.q2.filter(k => k.trim()),
            q3: answers.q3,
            q4: answers.q4,
            q5: answers.q5,
            q6: answers.q6,
            q7: answers.q7,
            q8: answers.q8,
          },
        });

      if (error) throw error;
      setStep('submitted');
    } catch (err: any) {
      if (err.message?.includes('unique') || err.code === '23505') {
        // Race condition on hv_code: regenerate and retry
        const newCode = await generateHvCode();
        setHvCode(newCode);
        setSubmitError('Mã học viên bị trùng, vui lòng thử gửi lại.');
      } else {
        setSubmitError(`Lỗi khi gửi khảo sát: ${err.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (courseLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--primary-200)', borderTopColor: 'var(--primary-500)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p>Đang tải thông tin khóa học...</p>
      </div>
    );
  }

  if (courseError) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <AlertCircle size={48} style={{ color: 'var(--error)', marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Không tìm thấy khóa học</h3>
        <p style={{ color: 'var(--neutral-600)' }}>{courseError}</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>

      {/* REGISTER STEP */}
      {step === 'register' && (
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'var(--primary-200)', borderRadius: '50%', color: 'var(--primary-800)', marginBottom: '1rem' }}>
              <ClipboardList size={36} />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Khảo Sát Sau Khóa Học</h2>
            {course && (
              <div style={{ marginBottom: '0.75rem' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }}>
                  {course.course_code}
                </span>
              </div>
            )}
            <p style={{ maxWidth: '550px', margin: '0 auto', color: 'var(--neutral-600)', fontWeight: 600, fontSize: '1.05rem' }}>
              {course?.name}
            </p>
            {course?.description && (
              <p style={{ maxWidth: '550px', margin: '0.5rem auto 0', color: 'var(--neutral-500)', fontSize: '0.9rem' }}>
                {course.description}
              </p>
            )}
          </div>

          <form onSubmit={handleRegister} style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="form-group">
              <label className="form-label">Họ và tên *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Nguyễn Văn A"
                value={fullname}
                onChange={e => setFullname(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mã nhân viên *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="NV-XXXXX"
                value={employeeCode}
                onChange={e => setEmployeeCode(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.5rem', fontSize: '1.05rem', padding: '0.85rem' }}
            >
              Bắt đầu khảo sát <ChevronRight size={18} />
            </button>
          </form>
        </div>
      )}

      {/* SURVEY STEP */}
      {step === 'survey' && (
        <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--primary-200)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Khảo Sát Sau Khóa Học</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--neutral-500)' }}>
                Học viên: <strong>{fullname}</strong> — Mã NV: <strong>{employeeCode}</strong>
              </p>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{hvCode}</span>
            </div>
          </div>

          {submitError && (
            <div style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {submitError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

            {/* Q1 */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                1. Bạn sẽ áp dụng những điều đã học như thế nào?
              </p>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Chia sẻ kế hoạch áp dụng kiến thức của bạn..."
                value={answers.q1}
                onChange={e => setAnswers({ ...answers, q1: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Q2 - 3 keywords */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                2. Nếu mô tả trải nghiệm học tập của mình bằng ba từ khóa, Anh/Chị sẽ lựa chọn những từ nào?
              </p>
              <div className="survey-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[0, 1, 2].map(idx => (
                  <input
                    key={idx}
                    type="text"
                    className="form-input"
                    placeholder={`Từ khóa ${idx + 1}`}
                    value={answers.q2[idx]}
                    onChange={e => handleKeywordChange(idx, e.target.value)}
                  />
                ))}
              </div>
            </div>

            {/* Q3 - Confidence 1-10 */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                3. Mức độ tự tin của Anh/Chị trong việc chuyển hóa các nội dung đã học thành hành động hoặc kết quả cụ thể trong công việc hiện nay là bao nhiêu?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAnswers({ ...answers, q3: n })}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md)',
                      border: answers.q3 === n ? '2px solid var(--primary-500)' : '1px solid var(--neutral-300)',
                      backgroundColor: answers.q3 === n ? 'var(--primary-500)' : 'white',
                      color: answers.q3 === n ? 'white' : 'var(--neutral-700)',
                      fontWeight: answers.q3 === n ? 700 : 400,
                      cursor: 'pointer',
                      fontSize: '1rem',
                      transition: 'var(--transition-smooth)',
                    }}
                  >
                    {n}
                  </button>
                ))}
                {answers.q3 > 0 && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary-700)' }}>
                    {answers.q3}/10 —{' '}
                    {answers.q3 >= 9 ? 'Rất tự tin' : answers.q3 >= 7 ? 'Tự tin' : answers.q3 >= 5 ? 'Khá tự tin' : 'Cần thêm thời gian'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '480px', fontSize: '0.75rem', color: 'var(--neutral-400)', marginTop: '0.5rem' }}>
                <span>1 — Chưa tự tin</span>
                <span>10 — Rất tự tin</span>
              </div>
            </div>

            {/* Q4 */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                4. Nếu khóa học tiếp tục được tổ chức, bạn vui lòng gợi ý những cải tiến trong nội dung đào tạo hoặc cách truyền đạt nội dung.
              </p>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Đề xuất cải tiến của bạn..."
                value={answers.q4}
                onChange={e => setAnswers({ ...answers, q4: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Q5 */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                5. Trong thời gian tới, Anh/Chị mong muốn tiếp tục được đào tạo hoặc phát triển thêm những năng lực nào để nâng cao hiệu quả công việc?
              </p>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Chia sẻ mong muốn phát triển của bạn..."
                value={answers.q5}
                onChange={e => setAnswers({ ...answers, q5: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Q6 - Consent yes/no */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                6. Bạn cho phép ONEX sử dụng hình ảnh của bạn trong lớp học của chúng ta để làm công tác truyền thông nhé? *
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {['Đồng ý', 'Không đồng ý'].map(opt => (
                  <label
                    key={opt}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      padding: '0.75rem 1.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: answers.q6 === opt ? '2px solid var(--primary-500)' : '1px solid var(--neutral-300)',
                      backgroundColor: answers.q6 === opt ? 'var(--primary-100)' : 'white',
                      fontWeight: answers.q6 === opt ? 600 : 400,
                      color: answers.q6 === opt ? 'var(--primary-800)' : 'var(--neutral-600)',
                      transition: 'var(--transition-smooth)',
                    }}
                  >
                    <input
                      type="radio"
                      name="q6"
                      value={opt}
                      checked={answers.q6 === opt}
                      onChange={() => setAnswers({ ...answers, q6: opt })}
                      style={{ accentColor: 'var(--primary-500)' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* Q7 - Multi-select topics */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                7. Những chủ đề đào tạo nào dưới đây Anh/Chị quan tâm trong tương lai?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                {TRAINING_TOPICS.map(topic => {
                  const isSelected = answers.q7.includes(topic);
                  return (
                    <label
                      key={topic}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        cursor: 'pointer',
                        padding: '0.65rem 0.9rem',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '1.5px solid var(--primary-400)' : '1px solid var(--neutral-200)',
                        backgroundColor: isSelected ? 'var(--primary-50)' : 'white',
                        fontSize: '0.9rem',
                        color: isSelected ? 'var(--primary-800)' : 'var(--neutral-600)',
                        fontWeight: isSelected ? 600 : 400,
                        transition: 'var(--transition-smooth)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTopicToggle(topic)}
                        style={{ accentColor: 'var(--primary-500)' }}
                      />
                      {topic}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Q8 */}
            <div>
              <p style={{ fontWeight: 700, color: 'var(--neutral-800)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                8. Để nâng cao hơn nữa chất lượng các chương trình đào tạo trong tương lai, Anh/Chị có đề xuất hoặc góp ý nào dành cho ONEX Logistics?
              </p>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Đề xuất hoặc góp ý của bạn..."
                value={answers.q8}
                onChange={e => setAnswers({ ...answers, q8: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2.5rem', borderTop: '1px solid var(--primary-200)', paddingTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setStep('register')}
              disabled={submitting}
            >
              <ChevronLeft size={16} /> Quay lại
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ minWidth: '180px' }}
            >
              {submitting ? 'Đang gửi...' : 'Gửi khảo sát'} <Send size={16} />
            </button>
          </div>
        </form>
      )}

      {/* SUBMITTED STEP */}
      {step === 'submitted' && (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: 'var(--success-bg)', borderRadius: '50%', color: 'var(--success)', marginBottom: '1.5rem' }}>
            <CheckCircle size={48} />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Gửi Khảo Sát Thành Công!</h2>
          <p style={{ maxWidth: '500px', margin: '0 auto 1rem', color: 'var(--neutral-600)' }}>
            Cảm ơn <strong>{fullname}</strong> đã hoàn thành khảo sát sau khóa học. Mã học viên của bạn là:
          </p>
          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'var(--primary-100)',
              color: 'var(--primary-800)',
              padding: '0.6rem 2rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 800,
              fontSize: '1.4rem',
              letterSpacing: '0.1em',
              marginBottom: '1.5rem',
              border: '1px solid var(--primary-300)',
              fontFamily: 'monospace',
            }}
          >
            {hvCode}
          </div>
          <p style={{ color: 'var(--neutral-500)', fontSize: '0.9rem' }}>
            Thông tin của bạn đã được ghi nhận. Ban tổ chức sẽ tổng hợp và phản hồi trong thời gian sớm nhất.
          </p>
        </div>
      )}

    </div>
  );
}
