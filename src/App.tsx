import { useState, useEffect } from 'react';
import QuizSection from './components/QuizSection';
import EvaluationSection from './components/EvaluationSection';
import FeedbackSection from './components/FeedbackSection';
import CourseSurveySection from './components/CourseSurveySection';
import LoginModal from './components/LoginModal';
import AdminDashboard from './components/AdminDashboard';
import {
  Compass, Award, Star, MessageSquare, Lock,
  ShieldCheck, LogOut, X, Home
} from 'lucide-react';
import { supabase } from './supabaseClient';
import './App.css';

type ActiveView = 'home' | 'quiz' | 'evaluation' | 'feedback' | 'admin' | 'course-survey';

const ADMIN_SESSION_KEY = 'onex_admin_session';

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [courseSurveyCode, setCourseSurveyCode] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  const [qrModalType, setQrModalType] = useState<'quiz' | 'evaluation' | null>(null);

  // Restore admin session after F5 / page reload
  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (saved) {
      setIsAdminLoggedIn(true);
      setAdminUsername(saved);
      setActiveView('admin');
    }
  }, []);

  // Navigate directly to the correct view when arriving via QR link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as ActiveView | null;
    if (view === 'course-survey') {
      const code = params.get('code') || '';
      setCourseSurveyCode(code);
      setActiveView('course-survey');
    } else if (view && ['quiz', 'evaluation', 'feedback'].includes(view)) {
      setActiveView(view);
    }
  }, []);

  // Load system logo settings on component mount
  useEffect(() => {
    async function loadSystemLogo() {
      try {
        const { data, error } = await supabase
          .from('onex_settings')
          .select('value')
          .eq('key', 'system_logo')
          .maybeSingle();

        if (!error && data) {
          setSystemLogo(data.value);
        }
      } catch (err) {
        console.error("Error loading system logo:", err);
      }
    }
    loadSystemLogo();
  }, []);

  const handleLoginSuccess = (username: string) => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, username);
    setIsAdminLoggedIn(true);
    setAdminUsername(username);
    setActiveView('admin');
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdminLoggedIn(false);
    setAdminUsername('');
    setActiveView('home');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* 1. NAVBAR */}
      <header className="glass" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid rgba(254, 243, 199, 0.8)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div className="container" style={{
          height: '75px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo */}
          <div 
            onClick={() => setActiveView('home')} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              cursor: 'pointer' 
            }}
          >
            {systemLogo ? (
              <img src={systemLogo} alt="ONEX Logo" style={{ height: '48px', maxWidth: '200px', objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{
                  backgroundColor: 'var(--primary-500)',
                  color: 'var(--neutral-900)',
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <Compass size={24} style={{ transform: 'rotate(15deg)' }} />
                </div>
                <div>
                  <span style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 800, 
                    color: 'var(--neutral-800)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1
                  }}>ONEX</span>
                  <span style={{ 
                    display: 'block', 
                    fontSize: '0.75rem', 
                    fontWeight: 600, 
                    color: 'var(--primary-600)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>Logistics Academy</span>
                </div>
              </>
            )}
          </div>

          {/* Central Navigation Tabs — hidden on mobile (replaced by bottom nav) */}
          {activeView !== 'admin' && activeView !== 'course-survey' && (
            <nav className="desktop-only" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <button 
                onClick={() => setActiveView('home')}
                className={`btn btn-ghost ${activeView === 'home' ? 'active' : ''}`}
                style={{
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem',
                  fontWeight: activeView === 'home' ? 700 : 500,
                  color: activeView === 'home' ? 'var(--primary-700)' : 'var(--neutral-600)',
                  backgroundColor: activeView === 'home' ? 'var(--primary-100)' : 'transparent',
                }}
              >
                Trang chủ
              </button>
              <button 
                onClick={() => setActiveView('quiz')}
                className={`btn btn-ghost ${activeView === 'quiz' ? 'active' : ''}`}
                style={{
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem',
                  fontWeight: activeView === 'quiz' ? 700 : 500,
                  color: activeView === 'quiz' ? 'var(--primary-700)' : 'var(--neutral-600)',
                  backgroundColor: activeView === 'quiz' ? 'var(--primary-100)' : 'transparent',
                }}
              >
                Bài thu hoạch
              </button>
              <button 
                onClick={() => setActiveView('evaluation')}
                className={`btn btn-ghost ${activeView === 'evaluation' ? 'active' : ''}`}
                style={{
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem',
                  fontWeight: activeView === 'evaluation' ? 700 : 500,
                  color: activeView === 'evaluation' ? 'var(--primary-700)' : 'var(--neutral-600)',
                  backgroundColor: activeView === 'evaluation' ? 'var(--primary-100)' : 'transparent',
                }}
              >
                Đánh giá khóa học
              </button>
              <button 
                onClick={() => setActiveView('feedback')}
                className={`btn btn-ghost ${activeView === 'feedback' ? 'active' : ''}`}
                style={{
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem',
                  fontWeight: activeView === 'feedback' ? 700 : 500,
                  color: activeView === 'feedback' ? 'var(--primary-700)' : 'var(--neutral-600)',
                  backgroundColor: activeView === 'feedback' ? 'var(--primary-100)' : 'transparent',
                }}
              >
                Góp ý
              </button>
            </nav>
          )}

          {/* Right Action: Login / Admin Dashboard Toggle */}
          <div>
            {isAdminLoggedIn ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-200)',
                    color: 'var(--primary-800)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--primary-400)',
                    textTransform: 'uppercase'
                  }}>
                    {adminUsername ? adminUsername.charAt(0) : 'A'}
                  </div>
                  <span className="desktop-only" style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--neutral-700)',
                    display: 'inline'
                  }}>
                    {adminUsername || 'Admin'}
                  </span>
                </div>
                <button 
                  onClick={handleAdminLogout}
                  className="btn btn-outline"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.5rem 1rem',
                    borderColor: 'var(--error)',
                    color: 'var(--error)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <LogOut size={14} /> Logout
                </button>
                <button 
                  onClick={() => setActiveView(activeView === 'admin' ? 'home' : 'admin')}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.5rem 1rem',
                    borderColor: 'var(--primary-400)',
                    backgroundColor: 'var(--primary-100)',
                    color: 'var(--primary-800)'
                  }}
                >
                  <ShieldCheck size={16} /> {activeView === 'admin' ? 'Trang chủ' : 'Bảng Quản trị'}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="btn btn-outline"
                style={{
                  fontSize: '0.85rem',
                  padding: '0.5rem 1.1rem',
                  borderColor: 'var(--primary-300)',
                  color: 'var(--primary-800)',
                  backgroundColor: 'rgba(254, 243, 199, 0.2)'
                }}
              >
                <Lock size={14} /> Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main
        className={activeView !== 'admin' && activeView !== 'course-survey' ? 'mobile-safe-bottom' : ''}
        style={{ flex: 1, backgroundColor: 'var(--primary-50)' }}
      >
        
        {/* ---------------- A. VIEW: HOME (LANDING PAGE) ---------------- */}
        {activeView === 'home' && (
          <div>
            {/* Hero Section */}
            <section className="gradient-bg" style={{ padding: '3rem 0 3.5rem', borderBottom: '1px solid var(--primary-200)' }}>
              <div className="container hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '3rem', alignItems: 'center' }}>
                
                {/* Hero Text */}
                <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
                  <span className="badge badge-primary" style={{ marginBottom: '1rem', fontSize: '0.8rem', padding: '0.35rem 1rem' }}>
                    Chương trình đào tạo tại ICD Sóng Thần
                  </span>
                  
                  <h1 className="hero-title" style={{ fontSize: '3rem', color: 'var(--neutral-900)', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.5rem' }}>
                    Vận hành kho chuyên nghiệp - <span className="text-gradient">Professional Warehouse Operation & Control</span>
                  </h1>
                  
                  <p style={{ fontSize: '1.15rem', color: 'var(--neutral-600)', marginBottom: '2.5rem', maxWidth: '650px', lineHeight: 1.6 }}>
                    Chào mừng bạn đến với hệ thống kiểm tra và đánh giá kết quả học tập dành cho nhân viên ONEX Training. Hãy thực hiện bài thu hoạch kiến thức và gửi đóng góp ý kiến để hoàn thiện khóa học tốt hơn.
                  </p>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => setQrModalType('quiz')} className="btn btn-primary" style={{ padding: '0.9rem 1.8rem', fontSize: '1rem' }}>
                      Bài thu hoạch <Award size={18} />
                    </button>
                    <button onClick={() => setQrModalType('evaluation')} className="btn btn-secondary" style={{ padding: '0.9rem 1.8rem', fontSize: '1rem' }}>
                      Đánh giá khóa học
                    </button>
                  </div>
                </div>

                {/* Hero Illustration Side — hidden on mobile */}
                <div className="hero-illustration" style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <div style={{
                    width: '320px',
                    height: '320px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-200)',
                    position: 'absolute',
                    zIndex: 0,
                    filter: 'blur(30px)',
                    opacity: 0.6,
                    top: '10px'
                  }} />
                  
                  <div className="glass-card pulse-hover" style={{
                    padding: '2.5rem',
                    position: 'relative',
                    zIndex: 1,
                    maxWidth: '350px',
                    textAlign: 'center',
                    border: '2px solid rgba(251, 191, 36, 0.4)',
                    boxShadow: 'var(--shadow-xl)'
                  }}>
                    <button 
                      onClick={() => alert("Chương trình đào tạo A.I. Logistics thực chiến tại ICD Sóng Thần giúp học viên làm chủ các ứng dụng Trí Tuệ Nhân Tạo để tối ưu hóa quản lý chuỗi cung ứng, tự động hóa quy trình kho bãi, và nâng cao hiệu quả vận tải.")}
                      className="btn btn-outline"
                      style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.5rem',
                        borderColor: 'var(--primary-400)',
                        backgroundColor: 'var(--primary-100)',
                        color: 'var(--primary-800)',
                        fontWeight: 'bold',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      Tìm hiểu
                    </button>
                    <div style={{ 
                      display: 'inline-flex', 
                      borderRadius: '50%', 
                      marginBottom: '1.5rem',
                      overflow: 'hidden',
                      width: '88px',
                      height: '88px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--primary-300)'
                    }}>
                      <img 
                        src="/logo AI.jpg" 
                        alt="A.I. Logistics" 
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover' 
                        }} 
                      />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--neutral-800)' }}>A.I. Logistics thực chiến</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: '1.5rem' }}>
                      Quản lý chuỗi cung ứng, Vận tải đường biển, Hàng không, Thủ tục hải quan và Lưu kho bãi.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-success">Vận tải</span>
                      <span className="badge badge-success">Hải quan</span>
                      <span className="badge badge-success">Kho bãi</span>
                    </div>
                  </div>
                </div>

              </div>
            </section>

            {/* Three Action Cards Section */}
            <section className="section-padding" style={{ backgroundColor: '#ffffff', paddingBottom: '2.5rem' }}>
              <div className="container">


                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
                  
                  {/* Card 1: Quiz */}
                  <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ color: 'var(--primary-600)', marginBottom: '1.25rem' }}>
                      <Award size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', color: 'var(--neutral-800)' }}>1. Bài Thu Hoạch</h3>
                    <p style={{ color: 'var(--neutral-500)', fontSize: '0.95rem', marginBottom: '2rem', flex: 1 }}>
                      Tham gia trả lời các câu hỏi trắc nghiệm đánh giá tổng hợp các kỹ năng cốt lõi về quy trình chuỗi cung ứng và vận tải hàng hóa. Nhận điểm số ngay lập tức.
                    </p>
                    <button onClick={() => setActiveView('quiz')} className="btn btn-primary" style={{ width: '100%' }}>
                      Bắt đầu làm bài
                    </button>
                  </div>

                  {/* Card 2: Evaluation */}
                  <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ color: 'var(--primary-600)', marginBottom: '1.25rem' }}>
                      <Star size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', color: 'var(--neutral-800)' }}>2. Đánh Giá Khóa Học</h3>
                    <p style={{ color: 'var(--neutral-500)', fontSize: '0.95rem', marginBottom: '2rem', flex: 1 }}>
                      Đánh giá mức độ hài lòng về giáo trình, giảng viên và điều kiện học tập. Đóng góp ý kiến tự luận để ONEX Training cải tiến dịch vụ giảng dạy.
                    </p>
                    <button onClick={() => setActiveView('evaluation')} className="btn btn-secondary" style={{ width: '100%' }}>
                      Khảo sát đánh giá
                    </button>
                  </div>

                  {/* Card 3: Feedback */}
                  <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ color: 'var(--primary-600)', marginBottom: '1.25rem' }}>
                      <MessageSquare size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', color: 'var(--neutral-800)' }}>3. Đóng Góp Ý Kiến</h3>
                    <p style={{ color: 'var(--neutral-500)', fontSize: '0.95rem', marginBottom: '2rem', flex: 1 }}>
                      Gửi thư góp ý, ý kiến phản hồi cá nhân, các thắc mắc về lớp học hoặc đề xuất mở rộng chuyên đề học tập với ban giám hiệu chương trình.
                    </p>
                    <button onClick={() => setActiveView('feedback')} className="btn btn-secondary" style={{ width: '100%' }}>
                      Gửi góp ý
                    </button>
                  </div>

                </div>
              </div>
            </section>

            {/* Course Features / Statistics */}
            <section className="gradient-bg" style={{ padding: '1.5rem 0', borderTop: '1px solid var(--primary-200)', borderBottom: '1px solid var(--primary-200)' }}>
              <div className="container">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--primary-600)', marginBottom: '0.25rem' }}>+500</div>
                    <div style={{ fontWeight: 700, color: 'var(--neutral-800)', fontSize: '1rem', marginBottom: '0.5rem' }}>Nhân Viên Đào Tạo</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>Cán bộ, nhân viên tại các ICD, cảng biển và doanh nghiệp Xuất nhập khẩu.</p>
                  </div>
                  <div>
                    <div style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--primary-600)', marginBottom: '0.25rem' }}>100%</div>
                    <div style={{ fontWeight: 700, color: 'var(--neutral-800)', fontSize: '1rem', marginBottom: '0.5rem' }}>Kiến Thức Thực Tế</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>Nội dung bài thi bám sát thực tiễn hoạt động logistics tại Việt Nam.</p>
                  </div>
                  <div>
                    <div style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--primary-600)', marginBottom: '0.25rem' }}>5★</div>
                    <div style={{ fontWeight: 700, color: 'var(--neutral-800)', fontSize: '1rem', marginBottom: '0.5rem' }}>Chất Lượng Giảng Dạy</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>Được đánh giá cao bởi các nhà quản trị chuỗi cung ứng hàng đầu.</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ---------------- B. CONTROLLING OTHER PANELS ---------------- */}
        {activeView !== 'home' && (
          <div className={activeView !== 'course-survey' ? 'container section-padding' : 'container'} style={activeView === 'course-survey' ? { paddingTop: '2.5rem', paddingBottom: '3rem' } : {}}>
            {activeView === 'quiz' && <QuizSection />}
            {activeView === 'evaluation' && <EvaluationSection />}
            {activeView === 'feedback' && <FeedbackSection />}
            {activeView === 'course-survey' && <CourseSurveySection courseCode={courseSurveyCode} />}
            {activeView === 'admin' && isAdminLoggedIn && (
              <AdminDashboard
                systemLogo={systemLogo}
                onLogoUpdate={(newLogo) => setSystemLogo(newLogo)}
              />
            )}
          </div>
        )}

      </main>

      {/* 3. FOOTER */}
      <footer style={{
        backgroundColor: 'var(--neutral-900)',
        color: '#ffffff',
        padding: '1.5rem 0',
        borderTop: '5px solid var(--primary-500)'
      }}>
        <div className="container">
          {/* Bottom Footer Credits */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.85rem',
            color: '#ffffff'
          }}>
            <span>© 2026 ONEX Training. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <span style={{ cursor: 'pointer' }}>Điều khoản sử dụng</span>
              <span style={{ cursor: 'pointer' }}>Chính sách bảo mật</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 4. MODALS */}
      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {qrModalType && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div className="glass-card" style={{ 
            width: '90%', 
            maxWidth: '400px', 
            padding: '2.5rem 2rem', 
            textAlign: 'center',
            border: '2px solid var(--primary-400)',
            boxShadow: 'var(--shadow-xl)',
            position: 'relative',
            backgroundColor: '#ffffff'
          }}>
            <button 
              onClick={() => setQrModalType(null)} 
              style={{ 
                position: 'absolute', 
                top: '1rem', 
                right: '1rem', 
                background: 'rgba(0,0,0,0.05)', 
                border: 'none', 
                color: 'var(--neutral-600)', 
                cursor: 'pointer',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'var(--transition-smooth)'
              }}
              className="pulse-hover"
            >
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--neutral-850)', fontWeight: 800 }}>
              {qrModalType === 'quiz' ? 'Quét QR Làm Bài Thu Hoạch' : 'Quét QR Đánh Giá Khóa Học'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Sử dụng camera điện thoại hoặc Zalo để quét mã QR và truy cập link trên điện thoại của bạn.
            </p>
            <div style={{
              display: 'inline-flex',
              padding: '1.25rem',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px solid var(--primary-200)',
              marginBottom: '1.5rem',
              boxShadow: '0 8px 20px rgba(146, 64, 14, 0.05)'
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?view=${qrModalType}`)}`}
                alt="QR Code Link"
                style={{ width: '200px', height: '200px', display: 'block' }}
              />
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: 'var(--primary-700)',
              wordBreak: 'break-all',
              fontWeight: 700,
              backgroundColor: 'var(--primary-100)',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.5rem'
            }}>
              {`${window.location.origin}${window.location.pathname}?view=${qrModalType}`}
            </div>

            <button 
              onClick={() => {
                setActiveView(qrModalType);
                setQrModalType(null);
              }}
              className="btn btn-primary" 
              style={{ width: '100%', fontSize: '0.95rem', padding: '0.75rem' }}
            >
              {qrModalType === 'quiz' ? 'Làm bài trên máy tính này' : 'Đánh giá trên máy tính này'}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation — shown only on mobile (≤768px) for main views */}
      {activeView !== 'admin' && activeView !== 'course-survey' && (
        <nav className="mobile-bottom-nav" aria-label="Điều hướng chính">
          {([
            { view: 'home' as ActiveView,       icon: <Home size={22} />,          label: 'Trang chủ' },
            { view: 'quiz' as ActiveView,        icon: <Award size={22} />,         label: 'Bài thi'   },
            { view: 'evaluation' as ActiveView,  icon: <Star size={22} />,          label: 'Đánh giá'  },
            { view: 'feedback' as ActiveView,    icon: <MessageSquare size={22} />, label: 'Góp ý'     },
          ] as const).map(({ view, icon, label }) => {
            const isActive = activeView === view;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.2rem',
                  padding: '0.35rem 0.25rem',
                  border: 'none',
                  background: isActive ? 'var(--primary-100)' : 'transparent',
                  color: isActive ? 'var(--primary-700)' : 'var(--neutral-400)',
                  fontSize: '0.65rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'inherit',
                  transition: 'color 0.2s, background 0.2s',
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .spin-slow {
          animation: rotate-compass 12s infinite linear;
        }
        @keyframes rotate-compass {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />

    </div>
  );
}

export default App;
