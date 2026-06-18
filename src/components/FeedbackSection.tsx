import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react';

export default function FeedbackSection() {
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname || !email || !phone || !subject || !content) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('onex_feedback')
        .insert({
          fullname,
          email,
          phone,
          subject,
          content
        });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting feedback:", err);
      setErrorMsg('Không thể gửi góp ý của bạn. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullname('');
    setEmail('');
    setPhone('');
    setSubject('');
    setContent('');
    setSubmitted(false);
  };

  return (
    <div className="fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      {!submitted ? (
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', padding: '1rem', backgroundColor: 'var(--primary-200)', borderRadius: '50%', color: 'var(--primary-800)', marginBottom: '1rem' }}>
              <MessageSquare size={36} />
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Gửi Góp Ý & Kiến Nghị</h2>
            <p style={{ maxWidth: '500px', margin: '0 auto' }}>
              Chúng tôi luôn trân trọng mọi ý kiến đóng góp, thắc mắc hoặc phản hồi trực tiếp từ bạn về chương trình học Logistics.
            </p>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Họ và tên *</label>
                <input 
                  type="text" 
                  required 
                  className="form-input" 
                  placeholder="Nguyễn Văn A" 
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
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
              <label className="form-label">Chủ đề đóng góp *</label>
              <input 
                type="text" 
                required 
                className="form-input" 
                placeholder="Ví dụ: Đóng góp giáo trình, Thắc mắc bài giảng..." 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nội dung chi tiết *</label>
              <textarea 
                required 
                className="form-input" 
                rows={5} 
                placeholder="Nội dung ý kiến đóng góp của bạn..." 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', fontSize: '1.05rem', padding: '0.85rem' }} disabled={submitting}>
              {submitting ? 'Đang gửi...' : 'Gửi thông tin góp ý'} <Send size={16} />
            </button>
          </form>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: 'var(--success-bg)', borderRadius: '50%', color: 'var(--success)', marginBottom: '1.5rem' }}>
            <CheckCircle2 size={48} />
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Gửi Góp Ý Thành Công!</h2>
          <p style={{ maxWidth: '500px', margin: '0 auto 2rem', color: 'var(--neutral-600)' }}>
            Cảm ơn bạn đã gửi ý kiến đóng góp cho ONEX Logistics. Ban quản lý chương trình học sẽ xem xét phản hồi của bạn và phản hồi lại sớm nhất có thể qua Email hoặc Điện thoại.
          </p>
          <button onClick={handleReset} className="btn btn-primary">
            Gửi thêm góp ý khác
          </button>
        </div>
      )}
    </div>
  );
}
