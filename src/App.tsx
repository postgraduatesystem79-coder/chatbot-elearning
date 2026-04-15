import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './lib/useAuth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { GeneralInstructions } from './pages/GeneralInstructions';
import { Dashboard } from './pages/Dashboard';
import { CourseList } from './pages/CourseList';
import { CourseLessons } from './pages/CourseLessons';
import { CourseDetail } from './pages/CourseDetail';
import { ChatbotPage } from './pages/ChatbotPage';
import { Forum } from './pages/Forum';
import { Profile } from './pages/Profile';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserManagement } from './pages/UserManagement';
import { QuizManagement } from './pages/QuizManagement';
import StudentQuestions from './pages/StudentQuestions';
import ChatRoom from './pages/ChatRoom';
import KnowledgeBase from './pages/KnowledgeBase';
import { Toaster } from 'sonner';
import './i18n';

function Home() {
  const { isTeacher, isAdmin, loading } = useAuth();
  
  if (loading) return null;
  if (isAdmin) return <Navigate to="/admin" />;
  if (isTeacher) return <Navigate to="/teacher" />;
  
  return <Navigate to="/chatbot" />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
      <Route path="/instructions" element={
        <ProtectedRoute>
          <Layout>
            <GeneralInstructions />
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Home />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/activities" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/courses" element={
        <ProtectedRoute>
          <Layout>
            <CourseList />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/courses/:id" element={
        <ProtectedRoute>
          <Layout>
            <CourseLessons />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/courses/:courseId/lessons/:lessonId" element={
        <ProtectedRoute>
          <Layout>
            <CourseDetail />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/chatbot" element={
        <ProtectedRoute>
          <Layout>
            <ChatbotPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/forum" element={
        <ProtectedRoute>
          <Layout>
            <Forum />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute>
          <Layout>
            <Profile />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/student-questions" element={
        <ProtectedRoute>
          <Layout>
            <StudentQuestions />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/chat-room" element={
        <ProtectedRoute>
          <Layout>
            <ChatRoom />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/knowledge-base" element={
        <ProtectedRoute requiredRole="teacher">
          <Layout>
            <KnowledgeBase />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/teacher" element={
        <ProtectedRoute requiredRole="teacher">
          <Layout>
            <TeacherDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <Layout>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/users" element={
        <ProtectedRoute requiredRole="teacher">
          <Layout>
            <UserManagement />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/quizzes" element={
        <ProtectedRoute requiredRole="teacher">
          <Layout>
            <QuizManagement />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
