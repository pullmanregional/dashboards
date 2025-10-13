import express from "express";
import cookieParser from "cookie-parser";
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(express.raw());
app.use(cookieParser());
app.set("json spaces", 2);
app.all("/echo", (req, res) =>
  res.json({
    method: req.method,
    url: req.url,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    params: req.params,
    query: req.query,
    headers: req.headers,
    cookies: req.cookies,
    body: req.body,
    protocol: req.protocol,
    secure: req.secure,
    ip: req.ip,
    hostname: req.hostname,
    path: req.path,
  })
);

const PORT = process.env.PORT || 4181;
app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
});
