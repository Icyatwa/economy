// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
  
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation Error',
        errors: Object.values(err.errors).map(error => error.message)
      });
    }
  
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Duplicate field value entered'
      });
    }
  
    res.status(500).json({
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  };
  
  module.exports = errorHandler;