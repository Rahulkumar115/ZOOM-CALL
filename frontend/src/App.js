import logo from './logo.svg';
import './App.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path='/' element={<LandingPage />}></Route>
          <Route path='/auth' element={<Authentication />}></Route>
        </Routes>
      </Router>
    </>
  );
}

export default App;
