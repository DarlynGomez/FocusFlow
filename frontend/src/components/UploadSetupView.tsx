import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import Header from './Header';
import GuidanceOption from './GuidanceOption';
import FileUploader from './FileUploader';

export default function UploadSetupView() {
  const [guidanceLevel, setGuidanceLevel] = useState('medium');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleStartReading = async () => {
    if (!file) {
      setUploadError("Please upload a PDF document first.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {

      const response = await fetch("http://localhost:8000/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log("Success! Backend returned:", data);
      
      // Logic of transitioning to another component/page goes below here

    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadError("Failed to upload the document. Is the backend server running?");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 font-sans pb-20">
      <Header />

      <main className="w-full max-w-3xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-50/50 p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <FileText className="w-6 h-6 text-indigo-500" />
            <h3 className="text-lg font-semibold text-slate-900">Upload your Document</h3>
          </div>
          <p className="text-sm text-slate-500 ml-9">
            Upload your PDF and customize your reading experience
          </p>
        </div>

        <div className="p-8 space-y-8">
          
          <section className="space-y-3">
            <label className="block text-sm font-medium text-slate-900">
              Document Upload
            </label>
            <FileUploader file={file} setFile={setFile} />
            
            {uploadError && (
              <p className="text-sm text-red-500 mt-2">{uploadError}</p>
            )}
          </section>

          <section className="space-y-3">
             <label className="block text-sm font-medium text-slate-900">
              Guidance Level
            </label>
            <div className="space-y-3">
              <GuidanceOption 
                id="light"
                title="Light support"
                description="Minimal interventions. Basic formatting and occasional check-ins."
                selected={guidanceLevel === 'light'}
                onClick={() => setGuidanceLevel('light')}
              />

              <GuidanceOption 
                id="medium"
                title="Medium Support (Recommended)"
                description="Balanced guidance with clear chunking and tracking."
                selected={guidanceLevel === 'medium'}
                onClick={() => setGuidanceLevel('medium')}
              />

              <GuidanceOption 
                id="heavy"
                title="Heavy Support"
                description="Frequent re-orientation, detailed context, and active reading assistance."
                selected={guidanceLevel === 'heavy'}
                onClick={() => setGuidanceLevel('heavy')}
              /> 
              
            </div>
          </section>

          <button 
            onClick={handleStartReading}
            disabled={isUploading || !file}
            className="w-full py-4 mt-4 text-white font-medium bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing Document...
              </>
            ) : (
              "Start Reading with FocusFlow"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}