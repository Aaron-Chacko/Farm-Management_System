import React from "react";
import "./Dashboard.css";

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>FarmConnect Dashboard</h1>
        <nav>
          <ul>
            <li><a href="/products">My Products</a></li>
            <li><a href="/add-product">Add Product</a></li>
            <li><a href="/orders">Orders</a></li>
            <li><a href="/logout">Logout</a></li>
          </ul>
        </nav>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-welcome">
          <h2>Welcome, Farmer 👨‍🌾</h2>
          <p>Here's an overview of your farm activities.</p>
        </section>

        <section className="dashboard-stats">
          <div className="stat-card">
            <h3>12</h3>
            <p>Products Listed</p>
          </div>
          <div className="stat-card">
            <h3>5</h3>
            <p>Pending Orders</p>
          </div>
          <div className="stat-card">
            <h3>₹23,400</h3>
            <p>Total Earnings</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;