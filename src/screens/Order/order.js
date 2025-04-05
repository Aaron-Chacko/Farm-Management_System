import React, { useEffect, useState } from 'react';
import './order.css';

const Order = ({ userType }) => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  const handleCancel = async (orderId) => {
    try {
      await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'PUT',
      });
      fetchOrders();
    } catch (err) {
      console.error('Error cancelling order:', err);
    }
  };

  return (
    <div className="order-container">
      <h2>Your Orders</h2>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <table className="order-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Product</th>
              <th>Quantity</th>
              <th>Status</th>
              <th>Date</th>
              {userType !== 'admin' && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{order.productName}</td>
                <td>{order.quantity}</td>
                <td className={`status ${order.status.toLowerCase()}`}>{order.status}</td>
                <td>{new Date(order.date).toLocaleDateString()}</td>
                {userType !== 'admin' && (
                  <td>
                    {order.status === 'Pending' ? (
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancel(order.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="no-action">-</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Order;
