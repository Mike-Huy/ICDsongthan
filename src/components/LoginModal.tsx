import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Try validation against the new onex_admins table first
      const { data: adminData, error: adminErr } = await supabase
        .from('onex_admins')
        .select('*')
        .eq('username', username.trim());

      if (!adminErr && adminData && adminData.length > 0) {
        const adminUser = adminData[0];
        if (adminUser.password === password) {
          onLoginSuccess(username.trim());
          setUsername('');
          setPassword('');
          onClose();
          return;
        } else {
          setErrorMsg('Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại.');
          setIsLoading(false);
          return;
        }
      }

      // 2. Fallback to onex_settings config
      const { data, error } = await supabase
        .from('onex_settings')
        .select('*')
        .in('key', ['admin_username', 'admin_password']);

      let dbUsername = 'onex_sadmin';
      let dbPassword = 'admin123'; // Default fallback credentials

      if (!error && data && data.length > 0) {
        const userRow = data.find(r => r.key === 'admin_username');
        const pwdRow = data.find(r => r.key === 'admin_password');

        if (userRow) {
          const uVal = userRow.value;
          dbUsername = typeof uVal === 'string' ? uVal : String(uVal);
        }
        if (pwdRow) {
          const pVal = pwdRow.value;
          dbPassword = typeof pVal === 'string' ? pVal : String(pVal);
        }
      }

      if (username.trim() === dbUsername && password === dbPassword) {
        onLoginSuccess(username.trim());
        setUsername('');
        setPassword('');
        onClose();
      } else {
        setErrorMsg('Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error("Error during admin login validation:", err);
      // Fallback credentials check offline if database connection fails or tables don't exist yet
      if (username.trim() === 'onex_sadmin' && password === 'admin123') {
        onLoginSuccess(username.trim());
        setUsername('');
        setPassword('');
        onClose();
      } else {
        setErrorMsg('Không thể kết nối đến cơ sở dữ liệu để xác thực. Thử lại với tài khoản mặc định.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(28, 25, 23, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.25s ease-out'
    }}>
      
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2.5rem 2rem',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: 'var(--neutral-400)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            padding: '0.85rem',
            backgroundColor: 'var(--primary-200)',
            color: 'var(--primary-800)',
            borderRadius: '50%',
            marginBottom: '1rem'
          }}>
            <Lock size={28} />
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Trang Quản Trị</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Đăng nhập để cập nhật đề thi, xem điểm và danh sách học viên.</p>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: 'var(--error-bg)',
            color: 'var(--error)',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.825rem',
            marginBottom: '1.25rem',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* Username Field */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Tên đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                className="form-input"
                placeholder="nhập user name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <User size={18} style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--neutral-400)'
              }} />
            </div>
          </div>

          {/* Password Field */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="form-input"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
              />
              <Lock size={18} style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--neutral-400)'
              }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--neutral-400)',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
