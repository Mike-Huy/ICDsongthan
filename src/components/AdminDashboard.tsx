import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Users, BookOpen, Star, Settings, LogOut, 
  Plus, Edit, Trash2, Save, Download, Upload, Search, 
  RefreshCw, X, ShieldAlert
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Question {
  id: string | number;
  quiz_id: string | number;
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

interface Submission {
  id: string | number;
  fullname: string;
  student_code: string;
  email: string;
  phone: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
}

interface EvalQuestion {
  id: string | number;
  question_text: string;
  question_type: 'rating' | 'text' | 'choice';
  options: string[] | null;
}

interface EvalSubmission {
  id: string | number;
  fullname: string;
  student_code: string;
  email: string;
  phone: string;
  answers: Record<string, any>;
  created_at: string;
}

interface Feedback {
  id: string | number;
  fullname: string;
  email: string;
  phone: string;
  subject: string;
  content: string;
  created_at: string;
}

interface AdminDashboardProps {
  onLogout: () => void;
  systemLogo: string | null;
  onLogoUpdate: (logo: string | null) => void;
}

export default function AdminDashboard({ onLogout, systemLogo, onLogoUpdate }: AdminDashboardProps) {
  // Tabs: 'submissions' | 'quiz_editor' | 'eval_editor' | 'settings' | 'user_management'
  const [activeTab, setActiveTab] = useState<'submissions' | 'quiz_editor' | 'eval_editor' | 'settings' | 'user_management'>('submissions');
  
  // Results view sub-tabs: 'quiz_results' | 'eval_results' | 'feedbacks'
  const [resultsSubTab, setResultsSubTab] = useState<'quiz_results' | 'eval_results' | 'feedbacks'>('quiz_results');

  // DB Availability Warning
  const [dbError, setDbError] = useState<string | null>(null);

  // Loaded Data States
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [evalQuestions, setEvalQuestions] = useState<EvalQuestion[]>([]);
  const [evalSubmissions, setEvalSubmissions] = useState<EvalSubmission[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Loading indicator
  const [loading, setLoading] = useState(false);

  // Forms / Modals States
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Partial<Quiz> | null>(null);

  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [editingEval, setEditingEval] = useState<Partial<EvalQuestion> | null>(null);

  // User Management states
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingAdminUser, setEditingAdminUser] = useState<any | null>(null);
  const [adminUserForm, setAdminUserForm] = useState({
    username: '',
    password: '',
    role: 'admin',
    permissions: ['quiz_editor', 'eval_editor', 'submissions']
  });
  const [userMsg, setUserMsg] = useState({ type: '', text: '' });

  // Password update form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

  // Logo upload state variables
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [logoMsg, setLogoMsg] = useState({ type: '', text: '' });

  // Sync logo prop to local input
  useEffect(() => {
    if (systemLogo) {
      setLogoUrlInput(systemLogo);
    } else {
      setLogoUrlInput('');
    }
  }, [systemLogo]);

  // Initial Load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // ---------------- LOGO CONFIG HANDLERS ----------------
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setLogoMsg({ type: 'error', text: 'Kích thước ảnh không vượt quá 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogoUrlInput(base64String);
      setLogoMsg({ type: 'success', text: 'Ảnh đã được tải lên và sẵn sàng để lưu.' });
    };
    reader.onerror = () => {
      setLogoMsg({ type: 'error', text: 'Lỗi khi đọc file ảnh.' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogo = async () => {
    setLogoMsg({ type: '', text: '' });
    if (!logoUrlInput) {
      setLogoMsg({ type: 'error', text: 'Vui lòng chọn file ảnh hoặc nhập URL ảnh.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('onex_settings')
        .upsert({
          key: 'system_logo',
          value: logoUrlInput
        });

      if (error) throw error;
      onLogoUpdate(logoUrlInput);
      setLogoMsg({ type: 'success', text: 'Đã lưu logo hệ thống thành công!' });
    } catch (err: any) {
      console.error("Error saving logo:", err);
      setLogoMsg({ type: 'error', text: `Lỗi khi lưu logo: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa logo tùy chỉnh và quay lại dùng logo mặc định?')) {
      return;
    }

    setLogoMsg({ type: '', text: '' });
    setLoading(true);
    try {
      const { error } = await supabase
        .from('onex_settings')
        .delete()
        .eq('key', 'system_logo');

      if (error) throw error;
      onLogoUpdate(null);
      setLogoUrlInput('');
      setLogoMsg({ type: 'success', text: 'Đã xóa logo tùy chỉnh. Website sẽ dùng logo mặc định.' });
    } catch (err: any) {
      console.error("Error deleting logo:", err);
      setLogoMsg({ type: 'error', text: `Lỗi khi xóa logo: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- EXCEL/CSV IMPORT & EXPORT HANDLERS ----------------
  const handleDownloadExcelTemplate = () => {
    const data = [
      {
        "Tên đề thi": "Bài thi trắc nghiệm ICD Sóng Thần",
        "Mô tả đề thi": "Bài đánh giá kiến thức nghiệp vụ kho bãi tại ICD Sóng Thần",
        "Thời gian làm bài (phút)": 15,
        "Câu hỏi": "Khái niệm ICD trong logistics là gì?",
        "Đáp án A": "Cảng cạn / Cảng khô",
        "Đáp án B": "Cảng nước sâu",
        "Đáp án C": "Kho ngoại quan",
        "Đáp án D": "Trung tâm phân phối",
        "Đáp án đúng (A/B/C/D)": "A",
        "Điểm số": 10
      },
      {
        "Tên đề thi": "Bài thi trắc nghiệm ICD Sóng Thần",
        "Mô tả đề thi": "Bài đánh giá kiến thức nghiệp vụ kho bãi tại ICD Sóng Thần",
        "Thời gian làm bài (phút)": 15,
        "Câu hỏi": "Thuật ngữ 3PL viết tắt cho loại hình dịch vụ nào?",
        "Đáp án A": "Third Party Logistics",
        "Đáp án B": "Three Port Logistics",
        "Đáp án C": "Triple Partners Logistics",
        "Đáp án D": "Third Port Location",
        "Đáp án đúng (A/B/C/D)": "A",
        "Điểm số": 10
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Đề Thi");
    
    // Download as a native binary .xls file
    XLSX.writeFile(workbook, "onex_excel_template_de_thi.xls", { bookType: "xls" });
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const ab = event.target?.result;
        if (!ab) return;

        const workbook = XLSX.read(ab, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays (header: 1 means array of rows)
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          alert('File trống hoặc không đúng định dạng mẫu.');
          return;
        }

        // Group questions by quiz name
        // quizTitle -> { description, duration, questions[] }
        const quizzesMap: { [key: string]: { description: string, duration: number, questions: any[] } } = {};

        // Find header columns to map positions dynamically (just in case they are reordered)
        const headers = (rows[0] as string[]).map(h => String(h || '').trim());
        const colIdx = {
          quizTitle: headers.indexOf("Tên đề thi"),
          quizDesc: headers.indexOf("Mô tả đề thi"),
          quizDuration: headers.indexOf("Thời gian làm bài (phút)"),
          questionText: headers.indexOf("Câu hỏi"),
          optA: headers.indexOf("Đáp án A"),
          optB: headers.indexOf("Đáp án B"),
          optC: headers.indexOf("Đáp án C"),
          optD: headers.indexOf("Đáp án D"),
          correctOpt: headers.indexOf("Đáp án đúng (A/B/C/D)"),
          score: headers.indexOf("Điểm số")
        };

        // Fallback to absolute indices if headers don't match exactly
        const getVal = (row: any[], index: number, fallbackIndex: number) => {
          const idx = index >= 0 ? index : fallbackIndex;
          return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
        };

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const quizTitle = getVal(row, colIdx.quizTitle, 0);
          const quizDesc = getVal(row, colIdx.quizDesc, 1);
          const quizDuration = parseInt(getVal(row, colIdx.quizDuration, 2)) || 15;
          const questionText = getVal(row, colIdx.questionText, 3);
          const optA = getVal(row, colIdx.optA, 4);
          const optB = getVal(row, colIdx.optB, 5);
          const optC = getVal(row, colIdx.optC, 6);
          const optD = getVal(row, colIdx.optD, 7);
          const correctOptStr = getVal(row, colIdx.correctOpt, 8).toUpperCase();
          const scoreVal = parseFloat(getVal(row, colIdx.score, 9)) || 10;

          if (!quizTitle || !questionText || !optA || !optB) continue;

          const options = [optA, optB];
          if (optC) options.push(optC);
          if (optD) options.push(optD);

          let correctOptionIndex = 0;
          if (correctOptStr === 'B') correctOptionIndex = 1;
          else if (correctOptStr === 'C') correctOptionIndex = 2;
          else if (correctOptStr === 'D') correctOptionIndex = 3;

          if (!quizzesMap[quizTitle]) {
            quizzesMap[quizTitle] = {
              description: quizDesc,
              duration: quizDuration,
              questions: []
            };
          }

          quizzesMap[quizTitle].questions.push({
            question_text: questionText,
            options: options,
            correct_option_index: correctOptionIndex,
            score: scoreVal
          });
        }

        const quizNames = Object.keys(quizzesMap);
        if (quizNames.length === 0) {
          alert('Không tìm thấy đề thi và câu hỏi hợp lệ nào trong file.');
          return;
        }

        const confirmMsg = `Bạn có chắc muốn nhập các đề thi sau từ file:\n` + 
          quizNames.map(name => `- Đề "${name}" (${quizzesMap[name].questions.length} câu)`).join('\n');
        
        if (!window.confirm(confirmMsg)) {
          return;
        }

        setLoading(true);

        // Process each quiz
        for (const qName of quizNames) {
          const quizData = quizzesMap[qName];
          let quizId: number | string | null = null;
          
          const { data: existingQuizzes, error: qFindErr } = await supabase
            .from('onex_quizzes')
            .select('*')
            .eq('title', qName);
          
          if (!qFindErr && existingQuizzes && existingQuizzes.length > 0) {
            quizId = existingQuizzes[0].id;
          } else {
            // Create a new quiz
            const { data: newQuizData, error: qCreateErr } = await supabase
              .from('onex_quizzes')
              .insert({
                title: qName,
                description: quizData.description,
                duration_minutes: quizData.duration
              })
              .select('*');
            
            if (!qCreateErr && newQuizData && newQuizData.length > 0) {
              quizId = newQuizData[0].id;
            } else {
              // Fallback offline quiz creation
              console.warn("DB quiz insert error, creating local temporary quiz:", qCreateErr);
              quizId = Date.now();
              const localQuiz = {
                id: quizId,
                title: qName,
                description: quizData.description,
                duration_minutes: quizData.duration
              };
              setQuizzes(prev => [...prev, localQuiz]);
            }
          }

          if (quizId) {
            // Prepare questions with quiz_id
            const finalQuestions = quizData.questions.map(q => ({
              ...q,
              quiz_id: quizId
            }));

            const { error: insErr } = await supabase
              .from('onex_questions')
              .insert(finalQuestions);

            if (insErr) {
              console.warn("Error inserting questions for quiz:", qName, insErr);
              // Fallback local insert
              const localQuestions = finalQuestions.map((q, idx) => ({
                ...q,
                id: Date.now() + idx
              }));
              setQuestions(prev => [...prev, ...localQuestions]);
            }
          }
        }

        alert('Đã nhập thành công toàn bộ đề thi và câu hỏi từ file Excel!');
        await fetchInitialData();

      } catch (err: any) {
        console.error("Error importing questions:", err);
        alert(`Lỗi khi nhập đề thi: ${err.message}`);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ---------------- USER & PERMISSION MANAGEMENT HANDLERS ----------------
  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('onex_admins')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data) {
        setAdminUsers(data);
      } else if (error) {
        console.warn("Error fetching admin users from Supabase, table might not exist yet:", error);
        // Fallback mock admin users
        setAdminUsers([
          { id: 1, username: 'onex_sadmin', role: 'super_admin', permissions: ['quiz_editor', 'eval_editor', 'settings', 'user_management', 'submissions'], created_at: new Date().toISOString() }
        ]);
      }
    } catch (err) {
      console.error("Error in fetchAdminUsers:", err);
    }
  };

  const handleOpenUserModal = (user: any = null) => {
    setUserMsg({ type: '', text: '' });
    if (user) {
      setEditingAdminUser(user);
      setAdminUserForm({
        username: user.username,
        password: '', // blank by default on edit
        role: user.role || 'admin',
        permissions: Array.isArray(user.permissions) ? user.permissions : ['quiz_editor']
      });
    } else {
      setEditingAdminUser(null);
      setAdminUserForm({
        username: '',
        password: '',
        role: 'admin',
        permissions: ['quiz_editor', 'eval_editor', 'submissions']
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg({ type: '', text: '' });

    if (!adminUserForm.username.trim()) {
      setUserMsg({ type: 'error', text: 'Vui lòng nhập tên đăng nhập.' });
      return;
    }

    if (!editingAdminUser && !adminUserForm.password) {
      setUserMsg({ type: 'error', text: 'Vui lòng nhập mật khẩu cho tài khoản mới.' });
      return;
    }

    setLoading(true);
    try {
      if (editingAdminUser) {
        // Update user
        const updateData: any = {
          username: adminUserForm.username.trim(),
          role: adminUserForm.role,
          permissions: adminUserForm.permissions
        };
        if (adminUserForm.password) {
          updateData.password = adminUserForm.password;
        }

        const { error } = await supabase
          .from('onex_admins')
          .update(updateData)
          .eq('id', editingAdminUser.id);

        if (error) throw error;
        setUserMsg({ type: 'success', text: 'Cập nhật tài khoản người dùng thành công!' });
      } else {
        // Create user
        const { error } = await supabase
          .from('onex_admins')
          .insert({
            username: adminUserForm.username.trim(),
            password: adminUserForm.password,
            role: adminUserForm.role,
            permissions: adminUserForm.permissions
          });

        if (error) throw error;
        setUserMsg({ type: 'success', text: 'Tạo tài khoản người dùng mới thành công!' });
      }

      await fetchAdminUsers();
      setTimeout(() => setIsUserModalOpen(false), 800);
    } catch (err: any) {
      console.error("Error saving admin user:", err);
      if (err.message && err.message.includes('relation') && err.message.includes('does not exist')) {
        setUserMsg({ type: 'error', text: 'Bảng "onex_admins" chưa tồn tại trong Database. Vui lòng chạy lệnh SQL khởi tạo.' });
      } else {
        setUserMsg({ type: 'error', text: `Lỗi: ${err.message}` });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdminUser = async (userId: number | string, username: string) => {
    if (username === 'onex_sadmin') {
      alert('Không thể xóa tài khoản Super Admin mặc định.');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('onex_admins')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      alert(`Đã xóa tài khoản "${username}" thành công.`);
      await fetchAdminUsers();
    } catch (err: any) {
      console.error("Error deleting admin user:", err);
      alert(`Lỗi khi xóa tài khoản: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      // 1. Fetch Quizzes
      const { data: quizData, error: quizErr } = await supabase.from('onex_quizzes').select('*').order('id', { ascending: true });
      if (quizErr) throw quizErr;
      
      setQuizzes(quizData || []);
      if (quizData && quizData.length > 0) {
        setSelectedQuiz(quizData[0]);
        // Fetch questions
        const { data: questionData } = await supabase.from('onex_questions').select('*').eq('quiz_id', quizData[0].id).order('id', { ascending: true });
        setQuestions(questionData || []);
      }

      // 2. Fetch Submissions
      const { data: subsData } = await supabase.from('onex_submissions').select('*').order('completed_at', { ascending: false });
      setSubmissions(subsData || []);

      // 3. Fetch Evaluations
      const { data: evalsData } = await supabase.from('onex_evaluations').select('*').order('id', { ascending: true });
      setEvalQuestions(evalsData || []);

      // 4. Fetch Evaluation Submissions
      const { data: evalSubsData } = await supabase.from('onex_evaluation_submissions').select('*').order('created_at', { ascending: false });
      setEvalSubmissions(evalSubsData || []);

      // 5. Fetch Feedbacks
      const { data: feedsData } = await supabase.from('onex_feedback').select('*').order('created_at', { ascending: false });
      setFeedbacks(feedsData || []);

      // 6. Fetch Admin Users
      await fetchAdminUsers();

    } catch (err: any) {
      console.error("Supabase Database load error in AdminDashboard:", err);
      if (err.message && err.message.includes('relation') && err.message.includes('does not exist')) {
        setDbError('Cảnh báo: Một số bảng dữ liệu ONEX chưa tồn tại trong cơ sở dữ liệu Supabase của bạn. Vui lòng sao chép nội dung tệp "supabase_schema.sql" và chạy nó trong trang SQL Editor của Supabase để khởi tạo bảng.');
      } else {
        setDbError(`Lỗi kết nối cơ sở dữ liệu: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch quiz questions when quiz selection changes
  const handleQuizChange = async (quizId: string | number) => {
    const quizObj = quizzes.find(q => String(q.id) === String(quizId));
    if (quizObj) {
      setSelectedQuiz(quizObj);
      setLoading(true);
      try {
        const { data } = await supabase.from('onex_questions').select('*').eq('quiz_id', quizObj.id).order('id', { ascending: true });
        setQuestions(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // ---------------- QUIZ CRUD OPERATIONS ----------------
  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuiz || !editingQuiz.title) return;
    setLoading(true);
    try {
      if (editingQuiz.id) {
        // Edit existing
        const { error } = await supabase.from('onex_quizzes').update({
          title: editingQuiz.title,
          description: editingQuiz.description,
          duration_minutes: Number(editingQuiz.duration_minutes || 30)
        }).eq('id', editingQuiz.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase.from('onex_quizzes').insert({
          title: editingQuiz.title,
          description: editingQuiz.description,
          duration_minutes: Number(editingQuiz.duration_minutes || 30)
        });
        if (error) throw error;
      }
      setIsQuizModalOpen(false);
      await fetchInitialData();
    } catch (err: any) {
      alert(`Lỗi khi lưu bài thi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string | number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài thi này và tất cả các câu hỏi liên quan?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('onex_quizzes').delete().eq('id', quizId);
      if (error) throw error;
      await fetchInitialData();
    } catch (err: any) {
      alert(`Lỗi khi xóa bài thi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- QUESTION CRUD OPERATIONS ----------------
  const handleOpenQuestionModal = (q?: Question) => {
    if (q) {
      setEditingQuestion({ ...q });
    } else {
      setEditingQuestion({
        quiz_id: selectedQuiz?.id,
        question_text: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        score: 10
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !editingQuestion.question_text || !selectedQuiz) return;
    setLoading(true);
    try {
      // Validate option fields
      const filteredOptions = (editingQuestion.options || []).map(opt => opt.trim());
      if (filteredOptions.some(opt => opt === '')) {
        alert('Tất cả các lựa chọn đáp án không được để trống.');
        setLoading(false);
        return;
      }

      const questionData = {
        quiz_id: selectedQuiz.id,
        question_text: editingQuestion.question_text,
        options: filteredOptions,
        correct_option_index: Number(editingQuestion.correct_option_index || 0),
        score: Number(editingQuestion.score || 10)
      };

      if (editingQuestion.id) {
        // Update
        const { error } = await supabase.from('onex_questions').update(questionData).eq('id', editingQuestion.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase.from('onex_questions').insert(questionData);
        if (error) throw error;
      }

      setIsQuestionModalOpen(false);
      // reload questions
      const { data } = await supabase.from('onex_questions').select('*').eq('quiz_id', selectedQuiz.id).order('id', { ascending: true });
      setQuestions(data || []);
    } catch (err: any) {
      alert(`Lỗi khi lưu câu hỏi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = async (id: string | number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('onex_questions').delete().eq('id', id);
      if (error) throw error;
      
      // Reload
      if (selectedQuiz) {
        const { data } = await supabase.from('onex_questions').select('*').eq('quiz_id', selectedQuiz.id).order('id', { ascending: true });
        setQuestions(data || []);
      }
    } catch (err: any) {
      alert(`Lỗi khi xóa câu hỏi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- EVALUATION CRUD OPERATIONS ----------------
  const handleOpenEvalModal = (e?: EvalQuestion) => {
    if (e) {
      setEditingEval({ ...e });
    } else {
      setEditingEval({
        question_text: '',
        question_type: 'rating',
        options: []
      });
    }
    setIsEvalModalOpen(true);
  };

  const handleSaveEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEval || !editingEval.question_text) return;
    setLoading(true);

    try {
      const data = {
        question_text: editingEval.question_text,
        question_type: editingEval.question_type,
        options: editingEval.question_type === 'choice' ? editingEval.options : null
      };

      if (editingEval.id) {
        const { error } = await supabase.from('onex_evaluations').update(data).eq('id', editingEval.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('onex_evaluations').insert(data);
        if (error) throw error;
      }

      setIsEvalModalOpen(false);
      // Reload
      const { data: reloadData } = await supabase.from('onex_evaluations').select('*').order('id', { ascending: true });
      setEvalQuestions(reloadData || []);
    } catch (err: any) {
      alert(`Lỗi khi lưu câu hỏi đánh giá: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEval = async (id: string | number) => {
    if (!confirm('Bạn có chắc muốn xóa câu hỏi khảo sát này?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('onex_evaluations').delete().eq('id', id);
      if (error) throw error;
      // Reload
      const { data: reloadData } = await supabase.from('onex_evaluations').select('*').order('id', { ascending: true });
      setEvalQuestions(reloadData || []);
    } catch (err: any) {
      alert(`Lỗi khi xóa: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- PASSWORD UPDATE ----------------
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    if (newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'Mật khẩu phải từ 6 ký tự trở lên.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('onex_settings')
        .upsert({
          key: 'admin_password',
          value: newPassword // JSON payload is directly the string
        });

      if (error) throw error;
      setPwdMsg({ type: 'success', text: 'Cập nhật mật khẩu quản trị thành công!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setPwdMsg({ type: 'error', text: `Lỗi lưu mật khẩu: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // ---------------- CSV EXPORTER ----------------
  const handleExportCSV = () => {
    if (submissions.length === 0) {
      alert('Không có dữ liệu kết quả học viên để xuất.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM
    csvContent += "Mã Số Học Viên,Họ Và Tên,Email,Số Điện Thoại,Điểm Số,Số Câu Đúng,Thời Gian Hoàn Thành\n";

    submissions.forEach((sub) => {
      const formattedDate = new Date(sub.completed_at).toLocaleString('vi-VN');
      const row = [
        `"${sub.student_code}"`,
        `"${sub.fullname}"`,
        `"${sub.email}"`,
        `"${sub.phone}"`,
        sub.score,
        `"${sub.correct_answers}/${sub.total_questions}"`,
        `"${formattedDate}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ONEX_Logistics_KetQuaThi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Submissions by Search
  const filteredSubmissions = submissions.filter(s => 
    s.fullname.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.student_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery)
  );

  const filteredEvalSubmissions = evalSubmissions.filter(s => 
    s.fullname.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.student_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '270px 1fr', minHeight: 'calc(100vh - 100px)', gap: '1.5rem', marginTop: '1rem' }}>
      
      {/* 1. LEFT SIDEBAR */}
      <aside className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid var(--primary-200)' }}>
        <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--primary-200)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--primary-700)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bảng quản lý</div>
          <div style={{ fontSize: '1.15rem', color: 'var(--neutral-800)', fontWeight: 800 }}>ONEX Training</div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button
            onClick={() => setActiveTab('submissions')}
            className={`sidebar-nav-btn ${activeTab === 'submissions' ? 'active' : ''}`}
          >
            <Users size={18} />
            <span>Kết quả học viên</span>
          </button>
          
          <button
            onClick={() => setActiveTab('quiz_editor')}
            className={`sidebar-nav-btn ${activeTab === 'quiz_editor' ? 'active' : ''}`}
          >
            <BookOpen size={18} />
            <span>Quản lý đề thi</span>
          </button>
          
          <button
            onClick={() => setActiveTab('eval_editor')}
            className={`sidebar-nav-btn ${activeTab === 'eval_editor' ? 'active' : ''}`}
          >
            <Star size={18} />
            <span>Quản lý khảo sát</span>
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`sidebar-nav-btn ${activeTab === 'settings' || activeTab === 'user_management' ? 'active' : ''}`}
          >
            <Settings size={18} />
            <span>Cấu hình hệ thống</span>
          </button>

          {(activeTab === 'settings' || activeTab === 'user_management') && (
            <div style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', borderLeft: '1px solid var(--primary-200)', marginLeft: '0.75rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
              <button
                onClick={() => setActiveTab('settings')}
                className={`sidebar-nav-btn`}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.5rem',
                  backgroundColor: activeTab === 'settings' ? 'var(--primary-100)' : 'transparent',
                  color: activeTab === 'settings' ? 'var(--primary-800)' : 'var(--neutral-600)',
                  fontWeight: activeTab === 'settings' ? 'bold' : 'normal',
                  justifyContent: 'flex-start',
                  minHeight: 'auto',
                  height: 'auto',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <span>Logo & Bảo mật</span>
              </button>
              
              <button
                onClick={() => setActiveTab('user_management')}
                className={`sidebar-nav-btn`}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.35rem 0.5rem',
                  backgroundColor: activeTab === 'user_management' ? 'var(--primary-100)' : 'transparent',
                  color: activeTab === 'user_management' ? 'var(--primary-800)' : 'var(--neutral-600)',
                  fontWeight: activeTab === 'user_management' ? 'bold' : 'normal',
                  justifyContent: 'flex-start',
                  minHeight: 'auto',
                  height: 'auto',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <span>Cấp & Phân quyền user</span>
              </button>
            </div>
          )}
        </nav>

        {/* Exit Button */}
        <button
          onClick={onLogout}
          className="btn btn-outline"
          style={{ width: '100%', borderColor: 'var(--primary-300)', color: 'var(--primary-800)', fontSize: '0.875rem', padding: '0.65rem 1rem' }}
        >
          <LogOut size={16} /> Thoát quản trị
        </button>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* DB Error Notification */}
        {dbError && (
          <div style={{
            backgroundColor: 'var(--error-bg)',
            borderLeft: '4px solid var(--error)',
            color: 'var(--neutral-800)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: '0.75rem',
            fontSize: '0.875rem'
          }}>
            <ShieldAlert size={24} style={{ color: 'var(--error)', flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--error)' }}>Yêu cầu cấu hình cơ sở dữ liệu</strong>
              <span>{dbError}</span>
            </div>
          </div>
        )}

        {/* ---------------- A. TAB: SUBMISSIONS / RESULTS ---------------- */}
        {activeTab === 'submissions' && (
          <div className="glass-card" style={{ padding: '2rem', minHeight: '400px' }}>
            
            {/* Header with Search and Export */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>Quản lý Thông Tin Học Viên</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>Danh sách bài thu hoạch, phiếu khảo sát đánh giá khóa học và góp ý của học viên.</p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button 
                  onClick={fetchInitialData} 
                  className="btn btn-ghost" 
                  style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                  title="Tải lại dữ liệu"
                >
                  <RefreshCw size={18} />
                </button>
                {resultsSubTab === 'quiz_results' && (
                  <button onClick={handleExportCSV} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                    <Download size={14} /> Xuất Excel (CSV)
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Tabs Selector */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--primary-200)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <button
                onClick={() => setResultsSubTab('quiz_results')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: resultsSubTab === 'quiz_results' ? '3px solid var(--primary-500)' : '3px solid transparent',
                  fontWeight: resultsSubTab === 'quiz_results' ? 'bold' : 'normal',
                  color: resultsSubTab === 'quiz_results' ? 'var(--neutral-800)' : 'var(--neutral-500)',
                  cursor: 'pointer'
                }}
              >
                Bài Thu Hoạch ({submissions.length})
              </button>
              <button
                onClick={() => setResultsSubTab('eval_results')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: resultsSubTab === 'eval_results' ? '3px solid var(--primary-500)' : '3px solid transparent',
                  fontWeight: resultsSubTab === 'eval_results' ? 'bold' : 'normal',
                  color: resultsSubTab === 'eval_results' ? 'var(--neutral-800)' : 'var(--neutral-500)',
                  cursor: 'pointer'
                }}
              >
                Đánh Giá Khóa Học ({evalSubmissions.length})
              </button>
              <button
                onClick={() => setResultsSubTab('feedbacks')}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: resultsSubTab === 'feedbacks' ? '3px solid var(--primary-500)' : '3px solid transparent',
                  fontWeight: resultsSubTab === 'feedbacks' ? 'bold' : 'normal',
                  color: resultsSubTab === 'feedbacks' ? 'var(--neutral-800)' : 'var(--neutral-500)',
                  cursor: 'pointer'
                }}
              >
                Góp ý ({feedbacks.length})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-400)' }} />
              <input
                type="text"
                placeholder="Tìm kiếm theo họ tên, mã số học viên, email..."
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>Đang truy xuất dữ liệu...</div>
            ) : (
              <div>
                
                {/* 1. QUIZ RESULTS SUBTAB */}
                {resultsSubTab === 'quiz_results' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--primary-200)', color: 'var(--neutral-800)', fontWeight: 'bold' }}>
                          <th style={{ padding: '0.75rem' }}>Học viên</th>
                          <th style={{ padding: '0.75rem' }}>Mã HV</th>
                          <th style={{ padding: '0.75rem' }}>Liên hệ</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Số câu đúng</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Điểm số</th>
                          <th style={{ padding: '0.75rem' }}>Ngày nộp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubmissions.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--neutral-400)' }}>Không tìm thấy bài nộp nào.</td></tr>
                        ) : (
                          filteredSubmissions.map((s) => (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--primary-100)' }}>
                              <td style={{ padding: '0.75rem', fontWeight: 600 }}>{s.fullname}</td>
                              <td style={{ padding: '0.75rem' }}><code>{s.student_code}</code></td>
                              <td style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                                <div>{s.email}</div>
                                <div style={{ color: 'var(--neutral-400)' }}>{s.phone}</div>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>{s.correct_answers} / {s.total_questions}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <span className={`badge ${s.score >= 5.0 ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.85rem', padding: '0.2rem 0.5rem' }}>
                                  {s.score}đ
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--neutral-500)' }}>
                                {new Date(s.completed_at).toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2. EVALUATION RESULTS SUBTAB */}
                {resultsSubTab === 'eval_results' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {filteredEvalSubmissions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-400)' }}>Chưa có phiếu khảo sát nào được nộp.</div>
                    ) : (
                      filteredEvalSubmissions.map((s) => (
                        <div key={s.id} className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-200)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px dashed var(--primary-200)', paddingBottom: '0.5rem' }}>
                            <div>
                              <strong style={{ fontSize: '1rem', color: 'var(--neutral-800)' }}>{s.fullname}</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginLeft: '0.5rem' }}>
                                (Mã: <code>{s.student_code}</code> | {s.email} | {s.phone})
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>
                              {new Date(s.created_at).toLocaleString('vi-VN')}
                            </span>
                          </div>

                          {/* Render evaluation answers */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {evalQuestions.map((eq) => {
                              const ansVal = s.answers[String(eq.id)];
                              return (
                                <div key={eq.id} style={{ fontSize: '0.875rem' }}>
                                  <span style={{ color: 'var(--neutral-500)', fontWeight: 600 }}>{eq.question_text}:</span>{' '}
                                  {eq.question_type === 'rating' ? (
                                    <span style={{ color: 'var(--primary-600)', fontWeight: 'bold' }}>
                                      {ansVal ? '★'.repeat(ansVal) + '☆'.repeat(5 - ansVal) : 'Chưa chấm'} ({ansVal}/5)
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--neutral-800)' }}>{ansVal || '(Không ghi ý kiến)'}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. FEEDBACKS SUBTAB */}
                {resultsSubTab === 'feedbacks' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {feedbacks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--neutral-400)' }}>Chưa có ý kiến góp ý nào được nộp.</div>
                    ) : (
                      feedbacks.map((f) => (
                        <div key={f.id} className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-200)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px dashed var(--primary-200)', paddingBottom: '0.5rem' }}>
                            <div>
                              <strong style={{ fontSize: '1rem', color: 'var(--neutral-800)' }}>{f.fullname}</strong>
                              <span style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginLeft: '0.5rem' }}>
                                ({f.email} | {f.phone})
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--neutral-400)' }}>
                              {new Date(f.created_at).toLocaleString('vi-VN')}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--neutral-700)' }}>Chủ đề:</span> {f.subject}
                          </div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--neutral-600)', backgroundColor: '#ffffff', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-100)', whiteSpace: 'pre-wrap' }}>
                            {f.content}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* ---------------- B. TAB: QUIZ EDITOR ---------------- */}
        {activeTab === 'quiz_editor' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            
            {/* Header and Quiz selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>Cấu hình Đề thi & Câu hỏi</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>Thêm, sửa đổi hoặc xóa các câu hỏi trong đề trắc nghiệm Logistics.</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={handleDownloadExcelTemplate}
                      className="btn btn-outline"
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      title="Tải file Excel/CSV mẫu"
                    >
                      <Download size={14} /> Excel template
                    </button>
                    
                    <label
                      className="btn btn-outline"
                      style={{ 
                        fontSize: '0.85rem', 
                        padding: '0.5rem 1rem', 
                        cursor: 'pointer', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.35rem', 
                        margin: 0,
                        backgroundColor: '#fef08a',
                        color: '#713f12',
                        borderColor: '#fde047'
                      }}
                      title="Nhập câu hỏi hàng loạt từ Excel/CSV"
                    >
                      <Upload size={14} /> Excel Import
                      <input
                        type="file"
                        accept=".xls,.xlsx,.csv"
                        onChange={handleExcelImport}
                        style={{ display: 'none' }}
                      />
                    </label>

                <button 
                  onClick={() => {
                    setEditingQuiz({ title: '', description: '', duration_minutes: 15 });
                    setIsQuizModalOpen(true);
                  }} 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.85rem' }}
                >
                  <Plus size={14} /> Tạo Bài Thi Mới
                </button>
              </div>
            </div>

            {/* Quiz Selector bar */}
            {quizzes.length > 0 && (
              <div className="glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Đang chọn đề:</label>
                  <select 
                    className="form-input" 
                    style={{ maxWidth: '350px', padding: '0.5rem' }}
                    value={selectedQuiz?.id || ''}
                    onChange={(e) => handleQuizChange(e.target.value)}
                  >
                    {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                  </select>
                </div>

                {selectedQuiz && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => {
                        setEditingQuiz({ ...selectedQuiz });
                        setIsQuizModalOpen(true);
                      }} 
                      className="btn btn-ghost" 
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      <Edit size={14} /> Sửa Đề Thi
                    </button>
                    <button 
                      onClick={() => handleDeleteQuiz(selectedQuiz.id)} 
                      className="btn btn-ghost" 
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--error)' }}
                    >
                      <Trash2 size={14} /> Xóa Đề Thi
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Question List for selected quiz */}
            {selectedQuiz ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--neutral-800)' }}>
                    Danh sách câu hỏi ({questions.length} câu)
                  </h4>
                  <button onClick={() => handleOpenQuestionModal()} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                    <Plus size={14} /> Thêm Câu Hỏi
                  </button>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>Đang tải danh sách câu hỏi...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {questions.length === 0 ? (
                      <div style={{ border: '2px dashed var(--primary-200)', borderRadius: 'var(--radius-md)', padding: '3rem', textAlign: 'center', color: 'var(--neutral-400)' }}>
                        Chưa có câu hỏi nào được tạo trong đề thi này. Hãy nhấn "Thêm Câu Hỏi" ở trên.
                      </div>
                    ) : (
                      questions.map((q, idx) => (
                        <div key={q.id} className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-200)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--neutral-800)' }}>
                              Câu {idx + 1}: {q.question_text}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                              <button onClick={() => handleOpenQuestionModal(q)} className="btn btn-ghost" style={{ padding: '0.4rem', color: 'var(--neutral-600)' }} title="Sửa">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDeleteQuestion(q.id)} className="btn btn-ghost" style={{ padding: '0.4rem', color: 'var(--error)' }} title="Xóa">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = oIdx === q.correct_option_index;
                              return (
                                <div key={oIdx} style={{
                                  fontSize: '0.85rem',
                                  padding: '0.5rem',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: isCorrect ? '#ecfdf5' : '#ffffff',
                                  border: isCorrect ? '1px solid #10b981' : '1px solid var(--primary-200)',
                                  color: isCorrect ? '#047857' : 'var(--neutral-600)',
                                  fontWeight: isCorrect ? 'bold' : 'normal',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isCorrect ? '#10b981' : 'var(--neutral-300)' }} />
                                  <span>{opt}</span>
                                </div>
                              );
                            })}
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--neutral-400)', display: 'flex', gap: '1rem' }}>
                            <span>Điểm cộng: <strong>{q.score}đ</strong></span>
                            <span>Mã câu hỏi: <code>{q.id}</code></span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--neutral-400)' }}>
                Chưa có đề thi nào. Hãy nhấn "Tạo Bài Thi Mới" ở góc trên.
              </div>
            )}

          </div>
        )}

        {/* ---------------- C. TAB: EVALUATION EDITOR ---------------- */}
        {activeTab === 'eval_editor' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>Cấu hình Phiếu Đánh Giá Khóa Học</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>Thêm hoặc sửa đổi các câu hỏi khảo sát ý kiến học viên về chương trình đào tạo.</p>
              </div>

              <button onClick={() => handleOpenEvalModal()} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                <Plus size={14} /> Thêm Câu Khảo Sát
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Đang tải danh sách khảo sát...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {evalQuestions.length === 0 ? (
                  <div style={{ border: '2px dashed var(--primary-200)', borderRadius: 'var(--radius-md)', padding: '3rem', textAlign: 'center', color: 'var(--neutral-400)' }}>
                    Chưa có câu hỏi khảo sát nào. Hãy nhấn nút để tạo mới.
                  </div>
                ) : (
                  evalQuestions.map((eq, idx) => (
                    <div key={eq.id} className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ color: 'var(--neutral-800)' }}>{idx + 1}. {eq.question_text}</strong>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--neutral-500)' }}>
                          <span>Loại câu hỏi: 
                            <strong style={{ marginLeft: '0.2rem', color: 'var(--primary-700)' }}>
                              {eq.question_type === 'rating' && 'Đánh giá 1-5 sao'}
                              {eq.question_type === 'text' && 'Ý kiến tự luận'}
                              {eq.question_type === 'choice' && 'Lựa chọn một'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleOpenEvalModal(eq)} className="btn btn-ghost" style={{ padding: '0.4rem', color: 'var(--neutral-600)' }} title="Sửa">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteEval(eq.id)} className="btn btn-ghost" style={{ padding: '0.4rem', color: 'var(--error)' }} title="Xóa">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ---------------- D. TAB: SYSTEM SETTINGS ---------------- */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Card 1: Logo Configuration */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Logo Hệ Thống</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginBottom: '1.5rem' }}>Cập nhật Logo hiển thị trên Header và Footer của Website.</p>
              
              <div style={{ borderTop: '1px solid var(--primary-200)', paddingTop: '1.5rem' }}>
                <label className="form-label">Xem trước Logo hiện tại</label>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--neutral-100)',
                  backgroundImage: 'radial-gradient(var(--neutral-200) 1px, transparent 0)',
                  backgroundSize: '10px 10px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '110px',
                  marginBottom: '1.25rem',
                  border: '1px solid var(--primary-200)'
                }}>
                  {systemLogo ? (
                    <img src={systemLogo} alt="ONEX Logo Preview" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--neutral-400)' }}>Đang sử dụng logo mặc định (ONEX)</span>
                  )}
                </div>

                {logoMsg.text && (
                  <div style={{
                    backgroundColor: logoMsg.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                    color: logoMsg.type === 'success' ? 'var(--success)' : 'var(--error)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}>
                    {logoMsg.text}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Tải lên Logo mới (PNG, JPG, SVG)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="form-input"
                    style={{ padding: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--neutral-400)', marginTop: '0.35rem', display: 'block' }}>
                    Kích thước tối đa 2MB. Khuyên dùng ảnh nền trong suốt (transparent).
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Hoặc nhập URL ảnh Logo trực tiếp</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    className="form-input"
                    value={logoUrlInput}
                    onChange={(e) => setLogoUrlInput(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    onClick={handleSaveLogo} 
                    className="btn btn-primary" 
                    style={{ fontSize: '0.85rem', flex: 1 }} 
                    disabled={loading}
                  >
                    <Save size={16} /> Lưu Logo
                  </button>
                  {systemLogo && (
                    <button 
                      type="button" 
                      onClick={handleDeleteLogo} 
                      className="btn btn-outline" 
                      style={{ fontSize: '0.85rem', borderColor: 'var(--error)', color: 'var(--error)' }}
                      disabled={loading}
                    >
                      Xóa Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Password Configuration */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Mật Khẩu Quản Trị</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)', marginBottom: '1.5rem' }}>Cập nhật mật khẩu bảo mật truy cập của tài khoản quản lý.</p>
              
              <form onSubmit={handleUpdatePassword} style={{ borderTop: '1px solid var(--primary-200)', paddingTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--neutral-800)', marginBottom: '1rem', fontWeight: 'bold' }}>Thay đổi mật khẩu đăng nhập</h4>
                
                {pwdMsg.text && (
                  <div style={{
                    backgroundColor: pwdMsg.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                    color: pwdMsg.type === 'success' ? 'var(--success)' : 'var(--error)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    fontSize: '0.85rem'
                  }}>
                    {pwdMsg.text}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Mật khẩu mới *</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Tối thiểu 6 ký tự..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Xác nhận mật khẩu mới *</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Nhập lại mật khẩu mới..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.85rem' }} disabled={loading}>
                  <Save size={16} /> Lưu mật khẩu mới
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ---------------- E. TAB: USER MANAGEMENT ---------------- */}
        {activeTab === 'user_management' && (
          <div className="glass-card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>Quản lý User & Phân Quyền</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--neutral-500)' }}>Cấp quyền và quản lý tài khoản truy cập vào trang quản trị.</p>
              </div>

              <button 
                onClick={() => handleOpenUserModal()} 
                className="btn btn-secondary" 
                style={{ fontSize: '0.85rem' }}
              >
                <Plus size={14} /> Thêm User Mới
              </button>
            </div>



            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Đang tải danh sách user...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--primary-200)', color: 'var(--neutral-800)', fontWeight: 'bold' }}>
                      <th style={{ padding: '0.75rem' }}>Tên đăng nhập</th>
                      <th style={{ padding: '0.75rem' }}>Vai trò</th>
                      <th style={{ padding: '0.75rem' }}>Quyền hạn</th>
                      <th style={{ padding: '0.75rem' }}>Ngày tạo</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid var(--primary-100)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{user.username}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span className={`badge ${user.role === 'super_admin' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.8rem' }}>
                            {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Editor'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {Array.isArray(user.permissions) && user.permissions.map((perm: string) => {
                              let label = perm;
                              if (perm === 'quiz_editor') label = 'Quản lý đề thi';
                              else if (perm === 'eval_editor') label = 'Quản lý khảo sát';
                              else if (perm === 'settings') label = 'Cấu hình hệ thống';
                              else if (perm === 'submissions') label = 'Xem kết quả học viên';
                              else if (perm === 'user_management') label = 'Quản lý user';
                              return (
                                <span key={perm} style={{
                                  backgroundColor: 'var(--neutral-100)',
                                  color: 'var(--neutral-700)',
                                  fontSize: '0.75rem',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--neutral-200)'
                                }}>
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--neutral-500)' }}>
                          {new Date(user.created_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button onClick={() => handleOpenUserModal(user)} className="btn btn-ghost" style={{ padding: '0.4rem', color: 'var(--neutral-600)' }} title="Sửa quyền">
                              <Edit size={14} />
                            </button>
                            {user.username !== 'onex_sadmin' && (
                              <button onClick={() => handleDeleteAdminUser(user.id, user.username)} className="btn btn-ghost" style={{ padding: '0.4rem', color: 'var(--error)' }} title="Xóa tài khoản">
                                <Trash2 size={14} />
                              </button>
                            )}
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

      </main>

      {/* ---------------- QUESTION CREATION / EDITING MODAL ---------------- */}
      {isQuestionModalOpen && editingQuestion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>{editingQuestion.id ? 'Cập Nhật Câu Hỏi' : 'Thêm Câu Hỏi Mới'}</h3>
              <button onClick={() => setIsQuestionModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveQuestion}>
              <div className="form-group">
                <label className="form-label">Nội dung câu hỏi *</label>
                <textarea
                  required
                  className="form-input"
                  rows={3}
                  placeholder="Nhập câu hỏi trắc nghiệm Logistics..."
                  value={editingQuestion.question_text || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                />
              </div>

              {/* 4 Options Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Các phương án trả lời *</label>
                {(editingQuestion.options || []).map((opt, oIdx) => (
                  <div key={oIdx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', width: '20px' }}>
                      {String.fromCharCode(65 + oIdx)}.
                    </span>
                    <input
                      type="text"
                      required
                      placeholder={`Phương án ${String.fromCharCode(65 + oIdx)}...`}
                      className="form-input"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...(editingQuestion.options || [])];
                        newOpts[oIdx] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOpts });
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Đáp án đúng *</label>
                  <select
                    className="form-input"
                    value={editingQuestion.correct_option_index}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, correct_option_index: Number(e.target.value) })}
                  >
                    {[0, 1, 2, 3].map(val => (
                      <option key={val} value={val}>Đáp án {String.fromCharCode(65 + val)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Điểm số cộng *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    className="form-input"
                    value={editingQuestion.score || 10}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, score: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--primary-200)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsQuestionModalOpen(false)} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }} disabled={loading}>Lưu câu hỏi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- QUIZ EDITING MODAL ---------------- */}
      {isQuizModalOpen && editingQuiz && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>{editingQuiz.id ? 'Cập Nhật Đề Thi' : 'Tạo Đề Thi Mới'}</h3>
              <button onClick={() => setIsQuizModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveQuiz}>
              <div className="form-group">
                <label className="form-label">Tiêu đề bài thi *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bài thi cuối kỳ Logistics..."
                  className="form-input"
                  value={editingQuiz.title || ''}
                  onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả bài thi</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Mô tả ngắn gọn về phạm vi kiến thức..."
                  value={editingQuiz.description || ''}
                  onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Thời gian làm bài (Phút) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  className="form-input"
                  value={editingQuiz.duration_minutes || 30}
                  onChange={(e) => setEditingQuiz({ ...editingQuiz, duration_minutes: Number(e.target.value) })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--primary-200)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsQuizModalOpen(false)} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }} disabled={loading}>Lưu đề thi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- EVALUATION CREATION / EDITING MODAL ---------------- */}
      {isEvalModalOpen && editingEval && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>{editingEval.id ? 'Cập Nhật Khảo Sát' : 'Thêm Câu Khảo Sát Mới'}</h3>
              <button onClick={() => setIsEvalModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveEval}>
              <div className="form-group">
                <label className="form-label">Nội dung câu hỏi khảo sát *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Tài liệu học tập của khóa học đầy đủ và chi tiết..."
                  className="form-input"
                  value={editingEval.question_text || ''}
                  onChange={(e) => setEditingEval({ ...editingEval, question_text: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Loại câu hỏi khảo sát *</label>
                <select
                  className="form-input"
                  value={editingEval.question_type}
                  onChange={(e) => setEditingEval({ ...editingEval, question_type: e.target.value as any })}
                >
                  <option value="rating">Đánh giá 1 - 5 sao (Rating)</option>
                  <option value="text">Nhập ý kiến tự luận (Text)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--primary-200)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsEvalModalOpen(false)} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }} disabled={loading}>Lưu câu khảo sát</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- USER CREATION / EDITING MODAL ---------------- */}
      {isUserModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div className="glass-card" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>{editingAdminUser ? 'Cập Nhật Quyền Hạn User' : 'Thêm User Quản Trị Mới'}</h3>
              <button onClick={() => setIsUserModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--neutral-400)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {userMsg.text && (
              <div style={{
                backgroundColor: userMsg.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
                color: userMsg.type === 'success' ? 'var(--success)' : 'var(--error)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem'
              }}>
                {userMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveAdminUser}>
              <div className="form-group">
                <label className="form-label">Tên đăng nhập *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: admin_logistics"
                  className="form-input"
                  disabled={!!editingAdminUser}
                  value={adminUserForm.username}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, username: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Mật khẩu {editingAdminUser ? '(Để trống nếu giữ nguyên)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingAdminUser}
                  placeholder="Nhập mật khẩu..."
                  className="form-input"
                  value={adminUserForm.password}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vai trò hệ thống *</label>
                <select
                  className="form-input"
                  value={adminUserForm.role}
                  onChange={(e) => setAdminUserForm({ ...adminUserForm, role: e.target.value })}
                >
                  <option value="super_admin">Super Admin (Toàn quyền)</option>
                  <option value="admin">Admin (Quản trị viên)</option>
                  <option value="editor">Editor (Biên tập viên nội dung)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Phân quyền chức năng:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.25rem' }}>
                  {[
                    { key: 'quiz_editor', label: 'Quản lý đề thi & câu hỏi' },
                    { key: 'eval_editor', label: 'Quản lý khảo sát' },
                    { key: 'settings', label: 'Cấu hình hệ thống (Logo, Mật khẩu)' },
                    { key: 'submissions', label: 'Xem kết quả bài nộp của học viên' },
                    { key: 'user_management', label: 'Quản lý tài khoản User & phân quyền' }
                  ].map((perm) => {
                    const isChecked = adminUserForm.permissions.includes(perm.key);
                    return (
                      <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let newPerms = [...adminUserForm.permissions];
                            if (e.target.checked) {
                              if (!newPerms.includes(perm.key)) newPerms.push(perm.key);
                            } else {
                              newPerms = newPerms.filter(p => p !== perm.key);
                            }
                            setAdminUserForm({ ...adminUserForm, permissions: newPerms });
                          }}
                        />
                        <span>{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--primary-200)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Hủy</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem' }} disabled={loading}>Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
