import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Home from './pages/Home';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import TrolleyList from './pages/TrolleyList';
import TrolleyDetail from './pages/TrolleyDetail';
import Dashboard from './pages/Dashboard';
import InstallPrompt from './components/InstallPrompt';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/shop" element={<ProductList />} />
        <Route path="/shop/product/:id" element={<ProductDetail />} />

        <Route path="/trolley" element={<TrolleyList />} />
        <Route path="/trolley/product/:id" element={<TrolleyDetail />} />

        <Route path="/dashboard" element={<Dashboard />} />

        {/* Before sections existed the shop lived at the root, so keep old
            bookmarks and home-screen shortcuts working. */}
        <Route path="/product/:id" element={<LegacyProductRedirect />} />
      </Routes>
      <InstallPrompt />
    </>
  );
}

function LegacyProductRedirect() {
  const { id } = useParams();
  return <Navigate to={`/shop/product/${id}`} replace />;
}
