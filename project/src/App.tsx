import { CssBaseline, Box } from '@mui/material';
import { BrowserRouter as Router } from 'react-router-dom';
import ThemeProvider from './context/ThemeContext';
import AppRoutes from './routes';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useLikeStore } from './store/likeStore';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function GlobalLikesSync() {
  const { user } = useAuthStore();
  const { fetchUserLikes } = useLikeStore();
  useEffect(() => {
    if (user) {
      fetchUserLikes();
    }
  }, [user, fetchUserLikes]);
  return null;
}

function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <ToastContainer position="top-center" autoClose={4000} hideProgressBar={true} newestOnTop={true} closeOnClick={true} pauseOnFocusLoss={true} draggable={true} pauseOnHover={true} />
      <Router>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          <Box component="main" sx={{ flexGrow: 1, width: '100%' }}>
            <GlobalLikesSync />
            <AppRoutes />
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;