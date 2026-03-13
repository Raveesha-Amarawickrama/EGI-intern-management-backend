
const errorHandler = (err, req, res, next) => {
  console.error(" Error:", err.message);


  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ success: false, message: `A record with that ${field} already exists.` });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message).join(", ");
    return res.status(400).json({ success: false, message: messages });
  }


  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid ID format." });
  }

  const status  = err.statusCode || 500;
  const message = err.message    || "Internal server error.";
  res.status(status).json({ success: false, message });
};

module.exports = errorHandler;