import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './screens/Login/Login';
import Register from './screens/Register/Register';
import ProductList from './screens/Productlist/ProductList';
import Dashboard from './screens/Dashboard/Dashboard';
import AddProduct from './screens/Add-products/add-products';
import Order from './screens/Order/order';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/products" element={<ProductList userRole="farmer" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/add-product" element={<AddProduct />} />
        <Route path="/orders" element={<Order userType="farmer" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;