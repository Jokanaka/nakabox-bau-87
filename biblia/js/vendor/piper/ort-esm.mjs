// onnxruntime-web 1.18.0 (UMD) exposto como módulo ES, para funcionar dentro do worker
import './ort.wasm.min.js';
const ort = globalThis.ort || self.ort;
export const InferenceSession = ort.InferenceSession;
export const Tensor = ort.Tensor;
export const env = ort.env;
export default ort;
