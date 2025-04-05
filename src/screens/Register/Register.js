import React, { useState } from "react";
import "./Register.css";

const Register = () => {
  const [userType, setUserType] = useState("farmer");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    aadhar: "",
    janaadharId: "",
    acknowledgeId: "",
    address: "",
    contact: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUserTypeChange = (type) => {
    setUserType(type);
    setFormData({
      name: "",
      email: "",
      password: "",
      aadhar: "",
      janaadharId: "",
      acknowledgeId: "",
      address: "",
      contact: "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(userType.toUpperCase(), formData);
    alert(`${userType} registered successfully!`);
  };

  return (
    <div className="page-wrapper">
      <div className="register-container">
        <h2>Register as {userType === "farmer" ? "Farmer" : "Consumer"}</h2>
        <div className="user-type-buttons">
          <button
            className={userType === "farmer" ? "active" : ""}
            onClick={() => handleUserTypeChange("farmer")}
          >
            Farmer
          </button>
          <button
            className={userType === "consumer" ? "active" : ""}
            onClick={() => handleUserTypeChange("consumer")}
          >
            Consumer
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            required
            value={formData.name}
            onChange={handleChange}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            value={formData.email}
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            value={formData.password}
            onChange={handleChange}
          />

          {userType === "farmer" && (
            <>
              <input
                type="text"
                name="aadhar"
                placeholder="Aadhar Number"
                required
                value={formData.aadhar}
                onChange={handleChange}
              />
              <input
                type="text"
                name="janaadharId"
                placeholder="Janaadhar ID"
                required
                value={formData.janaadharId}
                onChange={handleChange}
              />
              <input
                type="text"
                name="acknowledgeId"
                placeholder="Acknowledge ID"
                required
                value={formData.acknowledgeId}
                onChange={handleChange}
              />
            </>
          )}

          <input
            type="text"
            name="contact"
            placeholder="Contact Number"
            required
            value={formData.contact}
            onChange={handleChange}
          />

          <textarea
            name="address"
            placeholder="Address"
            required
            value={formData.address}
            onChange={handleChange}
          ></textarea>

          <button type="submit" className="submit-btn">
            Register
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;