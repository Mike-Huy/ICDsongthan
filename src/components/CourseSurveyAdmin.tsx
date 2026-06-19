import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import {
  Plus, Edit, Trash2, Save, Download, RefreshCw,
  X, QrCode, Eye, ChevronLeft,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Course {
  id: number;
  course_code: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface SurveyResponse {
  id: number;
  course_id: number;
  course_code: string;
  fullname: string;
  employee_code: string;
  hv_code: string;
  answers: Record<string, any>;
  created_at: string;
}

const QUESTION_LABELS: Record<string, string> = {
  q1: 'Áp dụng những điều đã học',
  q2: 'Ba từ khóa trải nghiệm',
  q3: 'Mức độ tự tin (1-10)',
  q4: 'Gợi ý cải tiến khóa học',
  q5: 'Mong muốn phát triển năng lực',
  q6: 'Cho phép dùng hình ảnh',
  q7: 'Chủ đề quan tâm tương lai',
  q8: 'Góp ý cho ONEX Logistics',
};

export default function CourseSurveyAdmin() {
  const [subTab, setSubTab] = useState<'courses' | 'responses'>('courses');

  // Courses
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Responses
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [viewingResponse, setViewingResponse] = useState<SurveyResponse | null>(null);

  // Course modal
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseMsg, setCourseMsg] = useState({ type: '', text: '' });

  // QR modal
  const [qrCourse, setQrCourse] = useState<Course | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const { data, error } = await supabase
        .from('onex_courses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCourses(data || []);
    } catch (err: any) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchResponses = async (course: Course) => {
    setLoadingResponses(true);
    setSelectedCourse(course);
    setSubTab('responses');
    try {
      const { data, error } = await supabase
        .from('onex_course_survey_responses')
        .select('*')
        .eq('course_code', course.course_code)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setResponses(data || []);
    } catch (err: any) {
      console.error('Error fetching responses:', err);
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleOpenCourseModal = (course?: Course) => {
    setCourseMsg({ type: '', text: '' });
    setEditingCourse(course ? { ...course } : { course_code: '', name: '', description: '' });
    setIsCourseModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse?.course_code?.trim() || !editingCourse?.name?.trim()) {
      setCourseMsg({ type: 'error', text: 'Vui lòng nhập đầy đủ mã khóa học và tên khóa học.' });
      return;
    }
    setSavingCourse(true);
    setCourseMsg({ type: '', text: '' });
    try {
      const payload = {
        course_code: editingCourse.course_code!.trim().toUpperCase(),
        name: editingCourse.name!.trim(),
        description: editingCourse.description?.trim() || null,
      };

      if (editingCourse.id) {
        const { error } = await supabase
          .from('onex_courses')
          .update(payload)
          .eq('id', editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('onex_courses')
          .insert(payload);
        if (error) throw error;
      }

      setCourseMsg({ type: 'success', text: editingCourse.id ? 'Cập nhật khóa học thành công!' : 'Tạo khóa học mới thành công!' });
      await fetchCourses();
      setTimeout(() => setIsCourseModalOpen(false), 700);
    } catch (err: any) {
      if (err.message?.includes('unique') || err.code === '23505') {
        setCourseMsg({ type: 'error', text: 'Mã khóa học đã tồn tại. Vui lòng dùng mã khác.' });
      } else {
        setCourseMsg({ type: 'error', text: `Lỗi: ${err.message}` });
      }
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm(`Xóa khóa học "${course.name}" (${course.course_code})?\nTất cả phản hồi khảo sát liên quan sẽ bị xóa theo.`)) return;
    try {
      const { error } = await supabase
        .from('onex_courses')
        .delete()
        .eq('id', course.id);
      if (error) throw error;
      await fetchCourses();
    } catch (err: any) {
      alert(`Lỗi khi xóa: ${err.message}`);
    }
  };

  const handleExportExcel = () => {
    if (responses.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }

    const data = responses.map((r, idx) => ({
      'STT': idx + 1,
      'Mã HV': r.hv_code,
      'Mã NV': r.employee_code,
      'Họ và Tên': r.fullname,
      'Mã Khóa Học': r.course_code,
      'C1 - Áp dụng kiến thức': r.answers?.q1 || '',
      'C2 - Ba từ khóa': Array.isArray(r.answers?.q2) ? r.answers.q2.join(', ') : r.answers?.q2 || '',
      'C3 - Mức tự tin (1-10)': r.answers?.q3 || '',
      'C4 - Gợi ý cải tiến': r.answers?.q4 || '',
      'C5 - Năng lực muốn phát triển': r.answers?.q5 || '',
      'C6 - Cho phép dùng hình ảnh': r.answers?.q6 || '',
      'C7 - Chủ đề quan tâm': Array.isArray(r.answers?.q7) ? r.answers.q7.join(', ') : r.answers?.q7 || '',
      'C8 - Góp ý cho ONEX': r.answers?.q8 || '',
      'Thời Gian': new Date(r.created_at).toLocaleString('vi-VN'),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 16 },
      { wch: 40 }, { wch: 30 }, { wch: 10 }, { wch: 40 }, { wch: 40 },
      { wch: 20 }, { wch: 40 }, { wch: 40 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kết quả khảo sát');
    XLSX.writeFile(wb, `ONEX_KhaoSat_${selectedCourse?.course_code || 'all'}_${new Date().toISOString().split('T')[0]}.xls`, { bookType: 'xls' });
  };

  const getSurveyUrl = (course: Course) =>
    `${window.location.origin}${window.location.pathname}?view=course-survey&code=${encodeURIComponent(course.course_code)}`;

  const formatAnswer = (_key: string, value: any): string => {
    if (Array.isArray(value)) return value.join(', ') || '—';
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  return (
    <div className="glass-card" style={{ padding: '2rem', minHeight: '400px' }}>

      {/* Detail response view */}
      {viewingResponse && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
              onClick={() => setViewingResponse(null)}
            >
              <ChevronLeft size={16} /> Quay lại
            </button>
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Chi tiết phản hồi</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', margin: 0 }}>
                {viewingResponse.fullname} — {viewingResponse.hv_code}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.entries(QUESTION_LABELS).map(([key, label]) => (
              <div
                key={key}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--primary-50)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '3px solid var(--primary-400)',
                }}
              >
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  {label}
                </p>
                <p style={{ fontSize: '0.95rem', color: 'var(--neutral-700)', margin: 0 }}>
                  {formatAnswer(key, viewingResponse.answers?.[key])}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Courses tab */}
      {!viewingResponse && subTab === 'courses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>Quản Lý Khóa Học & Khảo Sát</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>
                Tạo mã khóa học, sinh QR code và xem kết quả khảo sát của học viên.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" style={{ padding: '0.5rem' }} onClick={fetchCourses} title="Tải lại">
                <RefreshCw size={18} />
              </button>
              <button className="btn btn-primary" onClick={() => handleOpenCourseModal()} style={{ fontSize: '0.9rem' }}>
                <Plus size={16} /> Tạo khóa học
              </button>
            </div>
          </div>

          {loadingCourses ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-400)' }}>Đang tải...</div>
          ) : courses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-400)' }}>
              <p style={{ marginBottom: '1rem' }}>Chưa có khóa học nào. Hãy tạo khóa học đầu tiên!</p>
              <button className="btn btn-primary" onClick={() => handleOpenCourseModal()}>
                <Plus size={16} /> Tạo khóa học
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--primary-200)', backgroundColor: 'var(--primary-50)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Mã khóa học</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Tên khóa học</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Mô tả</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Ngày tạo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: 'var(--neutral-700)' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--primary-100)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-700)', backgroundColor: 'var(--primary-100)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                          {c.course_code}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{c.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--neutral-500)', maxWidth: '200px' }}>
                        <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {c.description || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
                        {new Date(c.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                            onClick={() => fetchResponses(c)}
                            title="Xem kết quả khảo sát"
                          >
                            <Eye size={15} /> Kết quả
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                            onClick={() => setQrCourse(c)}
                            title="QR khảo sát"
                          >
                            <QrCode size={15} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                            onClick={() => handleOpenCourseModal(c)}
                            title="Chỉnh sửa"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem', color: 'var(--error)' }}
                            onClick={() => handleDeleteCourse(c)}
                            title="Xóa"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Responses tab */}
      {!viewingResponse && subTab === 'responses' && selectedCourse && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                className="btn btn-outline"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                onClick={() => { setSubTab('courses'); setSelectedCourse(null); setResponses([]); }}
              >
                <ChevronLeft size={16} /> Danh sách khóa học
              </button>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
                  Kết quả khảo sát — <span style={{ color: 'var(--primary-700)' }}>{selectedCourse.course_code}</span>
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', margin: 0 }}>{selectedCourse.name}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" style={{ padding: '0.5rem' }} onClick={() => fetchResponses(selectedCourse)} title="Tải lại">
                <RefreshCw size={18} />
              </button>
              <button className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={handleExportExcel}>
                <Download size={14} /> Xuất Excel
              </button>
            </div>
          </div>

          {loadingResponses ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-400)' }}>Đang tải...</div>
          ) : responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-400)' }}>
              Chưa có phản hồi khảo sát nào cho khóa học này.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginBottom: '1rem' }}>
                Tổng cộng: <strong>{responses.length}</strong> phản hồi
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--primary-200)', backgroundColor: 'var(--primary-50)' }}>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Mã HV</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Mã NV</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Họ và Tên</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Mức tự tin</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Hình ảnh</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--neutral-700)' }}>Thời gian</th>
                    <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--neutral-700)' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--primary-100)' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: 'var(--primary-700)', fontWeight: 600 }}>{r.hv_code}</td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--neutral-600)' }}>{r.employee_code}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{r.fullname}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        {r.answers?.q3 ? (
                          <span style={{ fontWeight: 700, color: r.answers.q3 >= 7 ? 'var(--success)' : r.answers.q3 >= 5 ? 'var(--primary-600)' : 'var(--error)' }}>
                            {r.answers.q3}/10
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: r.answers?.q6 === 'Đồng ý' ? 'var(--success-bg)' : 'var(--error-bg)',
                          color: r.answers?.q6 === 'Đồng ý' ? 'var(--success)' : 'var(--error)',
                          fontWeight: 600,
                        }}>
                          {r.answers?.q6 || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                          onClick={() => setViewingResponse(r)}
                        >
                          <Eye size={14} /> Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* COURSE MODAL */}
      {isCourseModalOpen && editingCourse && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1200, animation: 'fadeIn 0.2s ease-out',
        }}>
          <div className="glass-card" style={{
            width: '90%', maxWidth: '520px', padding: '2rem',
            position: 'relative', backgroundColor: '#fff',
            border: '1.5px solid var(--primary-300)',
          }}>
            <button
              onClick={() => setIsCourseModalOpen(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              {editingCourse.id ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
            </h3>

            <form onSubmit={handleSaveCourse}>
              <div className="form-group">
                <label className="form-label">Mã khóa học *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: ICD-2026-001"
                  value={editingCourse.course_code || ''}
                  onChange={e => setEditingCourse({ ...editingCourse, course_code: e.target.value.toUpperCase() })}
                  disabled={!!editingCourse.id}
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
                {!editingCourse.id && (
                  <small style={{ color: 'var(--neutral-400)', fontSize: '0.78rem' }}>Mã sẽ được dùng trong URL QR code, không thể thay đổi sau khi tạo.</small>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Tên khóa học *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Vận hành kho chuyên nghiệp 2026"
                  value={editingCourse.name || ''}
                  onChange={e => setEditingCourse({ ...editingCourse, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả (tùy chọn)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Mô tả ngắn về khóa học..."
                  value={editingCourse.description || ''}
                  onChange={e => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {courseMsg.text && (
                <div style={{
                  padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '1rem',
                  backgroundColor: courseMsg.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                  color: courseMsg.type === 'success' ? 'var(--success)' : 'var(--error)',
                }}>
                  {courseMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsCourseModalOpen(false)} disabled={savingCourse}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={savingCourse}>
                  <Save size={16} /> {savingCourse ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* QR MODAL */}
      {qrCourse && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(28,25,23,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1200, animation: 'fadeIn 0.2s ease-out',
        }}>
          <div className="glass-card" style={{
            width: '90%', maxWidth: '420px', padding: '2rem 1.5rem',
            textAlign: 'center', position: 'relative', backgroundColor: '#fff',
            border: '1.5px solid var(--primary-300)',
          }}>
            <button
              onClick={() => setQrCourse(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>QR Khảo Sát</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', marginBottom: '1.25rem' }}>
              <strong>{qrCourse.course_code}</strong> — {qrCourse.name}
            </p>
            <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--primary-200)', marginBottom: '1.25rem' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(getSurveyUrl(qrCourse))}`}
                alt="QR Khảo sát"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--primary-700)', wordBreak: 'break-all', fontWeight: 600, backgroundColor: 'var(--primary-100)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
              {getSurveyUrl(qrCourse)}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
