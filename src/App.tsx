import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { SoftwareDetailPage } from './pages/SoftwareDetailPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors duration-200">
          <Navbar />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/software/:id" element={<SoftwareDetailPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
