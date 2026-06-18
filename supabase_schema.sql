-- 1. Create onex_quizzes table
create table if not exists public.onex_quizzes (
    id bigint primary key generated always as identity,
    title text not null,
    description text,
    duration_minutes integer not null default 30,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create onex_questions table
create table if not exists public.onex_questions (
    id bigint primary key generated always as identity,
    quiz_id bigint references public.onex_quizzes(id) on delete cascade,
    question_text text not null,
    options jsonb not null, -- Array of strings e.g. ["A", "B", "C", "D"]
    correct_option_index integer not null, -- 0-based index
    score integer not null default 10,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create onex_submissions table
create table if not exists public.onex_submissions (
    id bigint primary key generated always as identity,
    fullname text not null,
    student_code text not null,
    email text not null,
    phone text not null,
    quiz_id bigint references public.onex_quizzes(id) on delete set null,
    score numeric not null,
    total_questions integer not null,
    correct_answers integer not null,
    answers_json jsonb not null, -- Map of question ID to chosen option index
    completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create onex_evaluations table
create table if not exists public.onex_evaluations (
    id bigint primary key generated always as identity,
    question_text text not null,
    question_type text not null default 'rating', -- 'rating', 'text', 'choice'
    options jsonb, -- array of options if question_type is 'choice', else null
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create onex_evaluation_submissions table
create table if not exists public.onex_evaluation_submissions (
    id bigint primary key generated always as identity,
    fullname text not null,
    student_code text not null,
    email text not null,
    phone text not null,
    answers jsonb not null, -- Map of evaluation question ID to student's answer
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create onex_feedback table
create table if not exists public.onex_feedback (
    id bigint primary key generated always as identity,
    fullname text not null,
    email text not null,
    phone text not null,
    subject text not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Create onex_settings table for Admin credentials & system config
create table if not exists public.onex_settings (
    key text primary key,
    value jsonb not null
);

-- Disable Row Level Security (RLS) for all tables to allow simple public REST access using the publishable key.
alter table public.onex_quizzes disable row level security;
alter table public.onex_questions disable row level security;
alter table public.onex_submissions disable row level security;
alter table public.onex_evaluations disable row level security;
alter table public.onex_evaluation_submissions disable row level security;
alter table public.onex_feedback disable row level security;
alter table public.onex_settings disable row level security;

-- Seed default settings (Default admin credentials)
insert into public.onex_settings (key, value)
values 
('admin_username', '"onex_sadmin"'),
('admin_password', '"admin123"')
on conflict (key) do update set value = excluded.value;

-- Seed initial logistics quiz
insert into public.onex_quizzes (title, description, duration_minutes)
values ('Bài Thu Hoạch Kiến Thức Logistics Cơ Bản', 'Bài trắc nghiệm đánh giá kiến thức cơ bản về chuỗi cung ứng, vận tải, và quản trị kho bãi dành cho học viên chương trình đào tạo ONEX Logistics.', 15)
on conflict do nothing;

-- Seed initial quiz questions (for the quiz seeded above, assuming its ID is 1)
-- We insert using subqueries to map correctly to the first quiz
do $$
declare
    v_quiz_id bigint;
begin
    select id into v_quiz_id from public.onex_quizzes where title = 'Bài Thu Hoạch Kiến Thức Logistics Cơ Bản' limit 1;
    
    if v_quiz_id is not null then
        -- Insert question 1
        insert into public.onex_questions (quiz_id, question_text, options, correct_option_index, score) values
        (v_quiz_id, 'Mục tiêu tối cao của quản trị Logistics là gì?', '["Tối thiểu hóa chi phí nhưng vẫn đạt chất lượng dịch vụ khách hàng mong muốn", "Tối đa hóa doanh thu bán hàng của doanh nghiệp", "Sở hữu hệ thống kho bãi rộng lớn nhất để tích trữ hàng", "Cắt giảm tối đa số lượng nhân sự trong chuỗi cung ứng"]'::jsonb, 0, 10),
        
        (v_quiz_id, 'Hoạt động nào sau đây KHÔNG thuộc chuỗi hoạt động Logistics cốt lõi?', '["Vận tải nội địa và quốc tế", "Quản lý hàng tồn kho", "Nghiên cứu & phát triển sản phẩm mới (R&D)", "Đóng gói, dán nhãn hàng hóa"]'::jsonb, 2, 10),
        
        (v_quiz_id, 'Thuật ngữ "Incoterms" viết tắt của cụm từ tiếng Anh nào?', '["International Commercial Terms", "Internal Corporation Terms", "Industry Cooperative Terms", "International Cargo Terms"]'::jsonb, 0, 10),
        
        (v_quiz_id, 'Trong chuỗi cung ứng, mô hình phân phối hàng hóa "Cross-docking" có tác dụng gì?', '["Tăng thời gian lưu kho của hàng hóa nhằm tối ưu doanh số", "Chuyển tiếp hàng hóa trực tiếp từ phương tiện nhận sang phương tiện giao mà không qua lưu trữ trung gian", "Tự động hóa toàn bộ quy trình đóng gói trong kho", "Giảm số lượng phương tiện vận tải đường bộ khi xếp hàng lẻ"]'::jsonb, 1, 10),
        
        (v_quiz_id, 'Thuật ngữ "3PL" viết tắt cho loại hình dịch vụ logistics nào?', '["Third Party Logistics (Cung cấp dịch vụ logistics bên thứ ba)", "Three Port Logistics (Dịch vụ vận chuyển qua ba cảng liên kết)", "Triple Partners Logistics (Hợp tác liên minh ba bên)", "Third Port Location (Vị trí bốc dỡ hàng thứ ba)"]'::jsonb, 0, 10);
    end if;
end $$;

-- Seed default Course Evaluation Questions
insert into public.onex_evaluations (question_text, question_type, options) values
('Nội dung chương trình học hữu ích và thực tế với công việc Logistics.', 'rating', null),
('Giảng viên có kiến thức chuyên sâu và truyền đạt dễ hiểu.', 'rating', null),
('Cơ sở vật chất, tài liệu học tập và thời lượng khóa học được sắp xếp hợp lý.', 'rating', null),
('Mức độ hài lòng chung của bạn về chương trình đào tạo ONEX Logistics?', 'rating', null),
('Bạn có đề xuất gì để cải tiến chương trình học tốt hơn trong tương lai?', 'text', null);

-- 8. Create onex_admins table for multi-user user management
create table if not exists public.onex_admins (
    id bigint primary key generated always as identity,
    username text not null unique,
    password text not null,
    role text not null default 'admin', -- 'super_admin', 'admin', 'editor'
    permissions jsonb not null default '["quiz_editor", "eval_editor", "submissions"]'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable Row Level Security (RLS)
alter table public.onex_admins disable row level security;

-- Seed default super admin user
insert into public.onex_admins (username, password, role, permissions)
values 
('onex_sadmin', 'admin123', 'super_admin', '["quiz_editor", "eval_editor", "settings", "submissions", "user_management"]'::jsonb)
on conflict (username) do nothing;
