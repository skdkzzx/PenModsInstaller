export function SkeletonRow() {
  return (
    <div className="flex items-center px-4 py-2.5 border-b border-[#e2e8f0]">
      <span className="w-8 h-4 skeleton rounded" />
      <span className="flex-1 mx-2">
        <span className="inline-block h-4 skeleton rounded w-3/5" />
      </span>
      <span className="w-20 text-right"><span className="inline-block h-4 skeleton rounded w-16" /></span>
      <span className="w-28 text-right hidden sm:block"><span className="inline-block h-4 skeleton rounded w-20" /></span>
      <span className="w-8" />
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="file-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-4">
          <span className="w-12 h-12 skeleton rounded-xl" />
          <span className="w-16 h-3 skeleton rounded" />
        </div>
      ))}
    </div>
  );
}
