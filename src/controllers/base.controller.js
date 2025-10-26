export const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};
