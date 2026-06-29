export function EmptyState({ filter }: { filter: boolean }) {
  if (filter) {
    return (
      <div className="p-12 text-center">
        <svg className="w-10 h-10 text-[#cbd5e1] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p className="text-sm text-[#94a3b8]">未找到匹配的文件</p>
      </div>
    );
  }
  return (
    <div className="p-12 text-center">
      <svg className="w-10 h-10 text-[#cbd5e1] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <p className="text-sm text-[#94a3b8]">空目录</p>
      <p className="text-xs text-[#cbd5e1] mt-1">拖拽文件到此处上传</p>
    </div>
  );
}
