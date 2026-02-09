import { Navigate } from 'react-router-dom';

// Redirect to HomePage - actual content is in HomePage.tsx
const Index = () => {
  return <Navigate to="/" replace />;
};

export default Index;
