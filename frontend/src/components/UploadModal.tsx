import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image, Video, Code, Type, Upload, FileCode, Play } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

export function UploadModal() {
  const { isUploadModalOpen, uploadType, closeUploadModal, triggerRefresh } = useAppStore();
  const [scribeType, setScribeType] = useState<'text' | 'image' | 'html'>('text');
  const [content, setContent] = useState('');

  // Code Scribe State
  const [activeCodeTab, setActiveCodeTab] = useState<'html' | 'css' | 'js'>('html');
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [jsCode, setJsCode] = useState('');

  // File handling state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isUploadModalOpen) {
      // Reset state on close
      setScribeType('text');
      setContent('');
      setHtmlCode('');
      setCssCode('');
      setJsCode('');
      setActiveCodeTab('html');
      setSelectedFile(null);
      setError(null);
    }
  }, [isUploadModalOpen]);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type based on uploadType
      if (uploadType === 'omzo' && !file.type.startsWith('video/')) {
        setError('Please select a video file for Omzo');
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
  };

  const handlePost = async () => {
    if ((uploadType === 'omzo' || uploadType === 'story') && !selectedFile && !content) {
      setError('Please add a file or content');
      return;
    }
    if (uploadType === 'omzo' && !selectedFile) {
      setError('Video is required for Omzo');
      return;
    }

    if (uploadType === 'scribe' && scribeType === 'html' && !htmlCode && !cssCode && !jsCode) {
      setError('Please add some code');
      return;
    }

    setIsUploading(true);
    setCompressionProgress(0);
    setStatusText('Preparing upload...');
    setError(null);

    try {
      // Client-side processing
      let fileToUpload = selectedFile;

      if (fileToUpload) {
        if (fileToUpload.type.startsWith('image/')) {
          try {
            setStatusText('Optimizing image...');
            // Compress Image
            const { compressImage } = await import('@/utils/compression');
            fileToUpload = await compressImage(fileToUpload, {
              maxSizeMB: 1,
              maxWidthOrHeight: 1280,
              quality: 0.8
            });
          } catch (e) {
            console.error('Image compression failed', e);
            // Fallback to original
          }
        }
      }

      setStatusText('Uploading to server...');
      const formData = new FormData();

      if (uploadType === 'omzo') {
        if (fileToUpload) formData.append('video', fileToUpload);
        formData.append('caption', content);
        const success = await api.uploadOmzo(formData, (progress) => {
          setCompressionProgress(progress);
          if (progress < 100) {
            setStatusText('Uploading...');
          } else {
            setStatusText('Processing on server...');
          }
        });
        if (success) {
          closeUploadModal();
          triggerRefresh();
        } else {
          setError('Failed to upload Omzo');
        }
      } else if (uploadType === 'story') {
        // Backend keys: media, content, story_type
        if (fileToUpload) {
          formData.append('media', fileToUpload);
          formData.append('story_type', fileToUpload.type.startsWith('video/') ? 'video' : 'image');
        } else {
          formData.append('story_type', 'text');
        }
        if (content) formData.append('content', content);

        const success = await api.createStory(formData);
        if (success) {
          closeUploadModal();
          triggerRefresh();
        } else {
          setError('Failed to create story');
        }
      } else if (uploadType === 'scribe') {
        // Backend keys: image (for image file), content, content_type
        if (scribeType === 'html') {
          formData.append('content_type', 'code_scribe');
          formData.append('code_html', htmlCode);
          formData.append('code_css', cssCode);
          formData.append('code_js', jsCode);
        } else {
          formData.append('content_type', scribeType);
          if (fileToUpload) formData.append('image', fileToUpload);
        }

        formData.append('content', content);

        const response = await api.postScribe(formData);
        if (response.success) {
          closeUploadModal();
          triggerRefresh();
        } else {
          setError(response.error || 'Failed to post scribe');
        }
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };


  if (!isUploadModalOpen) return null;

  const scribeTypes = [
    { id: 'text', label: 'Text', icon: Type },
    { id: 'image', label: 'Media', icon: Image },
    { id: 'html', label: 'HTML/CSS/JS', icon: Code },
  ] as const;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={closeUploadModal}
      >
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl glass-card rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              {uploadType === 'scribe' ? 'New Scribe' : uploadType === 'omzo' ? 'New Omzo' : 'New Story'}
            </h2>
            <button
              onClick={closeUploadModal}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 flex-1 overflow-y-auto">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept={uploadType === 'omzo' ? 'video/*' : uploadType === 'story' ? 'image/*,video/*' : 'image/*,video/*'}
              onChange={handleFileSelect}
            />

            {uploadType === 'scribe' && (
              <>
                {/* Scribe type selector */}
                <div className="flex gap-2 mb-4">
                  {scribeTypes.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setScribeType(id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                        scribeType === id
                          ? 'bg-primary text-primary-foreground glow-primary'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Main Content Area */}
                {scribeType === 'html' ? (
                  <div className="space-y-4">
                    {/* Code Editor Tabs */}
                    <div className="flex items-center bg-secondary/30 rounded-t-xl overflow-hidden border-b border-border">
                      {(['html', 'css', 'js'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveCodeTab(tab)}
                          className={cn(
                            'px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2',
                            activeCodeTab === tab
                              ? 'border-primary text-primary bg-secondary/50'
                              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                          )}
                        >
                          <FileCode className="w-4 h-4" />
                          {tab === 'html' ? 'index.html' : tab === 'css' ? 'style.css' : 'index.js'}
                        </button>
                      ))}
                    </div>

                    {/* Code Editor */}
                    <div className="relative">
                      <textarea
                        value={activeCodeTab === 'html' ? htmlCode : activeCodeTab === 'css' ? cssCode : jsCode}
                        onChange={(e) => {
                          if (activeCodeTab === 'html') setHtmlCode(e.target.value);
                          else if (activeCodeTab === 'css') setCssCode(e.target.value);
                          else setJsCode(e.target.value);
                        }}
                        placeholder={`Enter ${activeCodeTab.toUpperCase()} code here...`}
                        className="w-full h-64 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 rounded-b-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 leading-relaxed"
                        spellCheck={false}
                      />
                    </div>

                    <textarea
                      placeholder="Add a description for your code..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full h-20 bg-secondary rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ) : (
                  /* Standard Text/Image Scribe */
                  <>
                    <textarea
                      placeholder="What's on your mind?"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full h-32 bg-secondary rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    {/* Media upload area */}
                    {scribeType !== 'text' && (
                      <div
                        onClick={triggerFileSelect}
                        className="mt-4 border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-secondary/50 transition-colors bg-secondary/20 min-h-[160px] flex items-center justify-center relative overflow-hidden group"
                      >
                        {selectedFile && previewUrl ? (
                          selectedFile.type.startsWith('video/') ? (
                            <video src={previewUrl} className="w-full h-full object-contain max-h-[200px] rounded-lg" controls />
                          ) : (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain max-h-[200px] rounded-lg" />
                          )
                        ) : (
                          <div className="py-4">
                            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Drop images or videos here
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {uploadType === 'omzo' && (
              <>
                {/* Video upload area */}
                <div
                  onClick={triggerFileSelect}
                  className="border-2 border-dashed border-border rounded-xl p-4 text-center mb-4 cursor-pointer hover:bg-secondary/50 transition-colors bg-secondary/20 min-h-[200px] flex items-center justify-center relative overflow-hidden"
                >
                  {selectedFile && previewUrl ? (
                    <div className="w-full h-full flex flex-col items-center">
                      <video src={previewUrl} className="w-full h-full object-cover max-h-[300px] rounded-lg" controls />
                    </div>
                  ) : (
                    <div className="py-8">
                      <Video className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium mb-1">Upload vertical video</p>
                      <p className="text-sm text-muted-foreground">
                        Drag and drop or click to browse
                      </p>
                    </div>
                  )}
                </div>

                {/* Caption */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write a caption..."
                  className="w-full h-24 bg-secondary rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </>
            )}

            {uploadType === 'story' && (
              <>
                {/* Story upload area */}
                <div
                  onClick={triggerFileSelect}
                  className="border-2 border-dashed border-border rounded-xl p-4 text-center mb-4 cursor-pointer hover:bg-secondary/50 transition-colors bg-secondary/20 min-h-[200px] flex items-center justify-center relative overflow-hidden"
                >
                  {selectedFile && previewUrl ? (
                    <div className="w-full h-full flex items-center justify-center">
                      {selectedFile.type.startsWith('video/') ? (
                        <video src={previewUrl} className="w-full h-full object-contain max-h-[300px] rounded-lg" controls />
                      ) : (
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain max-h-[300px] rounded-lg" />
                      )}
                    </div>
                  ) : (
                    <div className="py-8">
                      <Image className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium mb-1">Upload image or video</p>
                      <p className="text-sm text-muted-foreground">
                        Share a moment that disappears in 24 hours
                      </p>
                    </div>
                  )}
                </div>

                {/* Caption (optional) */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add a caption (optional)..."
                  className="w-full h-20 bg-secondary rounded-xl p-4 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </>
            )}

            {error && (
              <div className="mt-2 text-sm text-destructive text-center">
                {error}
              </div>
            )}
          </div>

          {/* Processing Status */}
          {isUploading && (
            <div className="px-6 pb-4">
              <div className="w-full flex justify-between text-xs mb-2 text-muted-foreground font-medium">
                <span className="flex items-center gap-2">
                  {compressionProgress > 0 && compressionProgress < 100 ? (
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  {statusText || 'Processing...'}
                </span>
                <span>{compressionProgress > 0 && compressionProgress < 100 ? `${compressionProgress}%` : ''}</span>
              </div>
              <div className="h-2 w-full bg-secondary/50 rounded-full overflow-hidden relative">
                <div
                  className={`h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-300 ease-out rounded-full ${compressionProgress === 0 || compressionProgress === 100 ? 'animate-pulse' : ''}`}
                  style={{ width: compressionProgress > 0 && compressionProgress < 100 ? `${compressionProgress}%` : '100%' }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-border flex justify-end gap-3">
            {/* Run/Preview Button for Code Scribes - Optional enhancement could go here */}

            <button
              onClick={closeUploadModal}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              onClick={handlePost}
              disabled={isUploading || (uploadType === 'omzo' && !selectedFile)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground glow-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Posting...
                </>
              ) : 'Post'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
