import React, { useEffect, useState } from 'react';
import './ProductList.css';

const ProductList = ({ userRole }) => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error(err));
  }, []);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id) => {
    fetch(`/api/products/${id}`, { method: 'DELETE' })
      .then(() => setProducts(products.filter(p => p.id !== id)));
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    const method = editingProduct.id ? 'PUT' : 'POST';
    const endpoint = editingProduct.id ? `/api/products/${editingProduct.id}` : '/api/products';

    fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProduct)
    }).then(() => {
      if (editingProduct.id) {
        setProducts(products.map(p => p.id === editingProduct.id ? editingProduct : p));
      } else {
        setProducts([...products, editingProduct]);
      }
      setEditingProduct(null);
    });
  };

  return (
    <div className="product-list">
      <h2>{userRole === 'farmer' ? 'My Products' : 'Available Products'}</h2>

      <input
        type="text"
        placeholder="Search products..."
        className="search-input"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />

      {userRole === 'farmer' && (
        <button className="add-btn" onClick={() => setEditingProduct({ name: '', price: '', quantity: '' })}>
          Add Product
        </button>
      )}

      <div className="product-table">
        {filteredProducts.map(product => (
          <div className="product-item" key={product.id}>
            <span><strong>{product.name}</strong></span>
            <span>₹{product.price}</span>
            <span>{product.quantity} kg</span>

            {userRole === 'farmer' && (
              <div className="product-actions">
                <button onClick={() => handleEdit(product)}>Edit</button>
                <button onClick={() => handleDelete(product.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingProduct && (
        <div className="edit-form">
          <h3>{editingProduct.id ? 'Edit Product' : 'Add New Product'}</h3>
          <form onSubmit={handleUpdate}>
            <input
              type="text"
              value={editingProduct.name}
              placeholder="Product Name"
              onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
              required
            />
            <input
              type="number"
              value={editingProduct.price}
              placeholder="Price"
              onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
              required
            />
            <input
              type="number"
              value={editingProduct.quantity}
              placeholder="Quantity"
              onChange={(e) => setEditingProduct({ ...editingProduct, quantity: e.target.value })}
              required
            />
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditingProduct(null)}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProductList;