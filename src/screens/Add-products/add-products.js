import React, { useState } from 'react';
import './add-products.css';

const AddProduct = () => {
  const [product, setProduct] = useState({
    name: '',
    price: '',
    quantity: '',
    description: '',
    image: null
  });

  const [previewUrl, setPreviewUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProduct(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setProduct(prev => ({ ...prev, image: file }));
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', product.name);
    formData.append('price', product.price);
    formData.append('quantity', product.quantity);
    formData.append('description', product.description);
    formData.append('image', product.image);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setSuccessMessage('Product added successfully!');
      setProduct({ name: '', price: '', quantity: '', description: '', image: null });
      setPreviewUrl('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="add-product-container">
      <h2>Add New Product</h2>

      {successMessage && <div className="success-message">{successMessage}</div>}

      <form onSubmit={handleSubmit} className="add-product-form" encType="multipart/form-data">
        <input
          type="text"
          name="name"
          placeholder="Product Name"
          value={product.name}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="price"
          placeholder="Price (₹)"
          value={product.price}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="quantity"
          placeholder="Quantity (kg)"
          value={product.quantity}
          onChange={handleChange}
          required
        />

        <textarea
          name="description"
          placeholder="Description"
          value={product.description}
          onChange={handleChange}
          required
        />

        <input
          type="file"
          name="image"
          accept="image/*"
          onChange={handleImageChange}
          required
        />

        {previewUrl && (
          <img src={previewUrl} alt="Preview" className="preview-img" />
        )}

        <button type="submit">Add Product</button>
      </form>
    </div>
  );
};

export default AddProduct;