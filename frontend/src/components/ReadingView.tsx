import { useNavigate } from "react-router-dom";

export default function ReadingView() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Reading View
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          This is where chunked content will appear.
        </p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-indigo-500 hover:text-indigo-600 underline"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
