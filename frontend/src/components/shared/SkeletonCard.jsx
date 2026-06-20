/*
  SkeletonCard — grey shimmer placeholder
  shown while data is loading.
  Looks much more professional than a spinner.
*/
export function SkeletonLine({ w = "100%", h = "12px" }) {
  return (
    <div
      className="animate-pulse bg-slate-200 rounded-lg"
      style={{ width: w, height: h }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
      <SkeletonLine w="40%" h="14px" />
      <SkeletonLine w="70%" h="10px" />
      <SkeletonLine w="55%" h="10px" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <SkeletonLine w="30%" h="14px" />
      </div>
      <div className="divide-y divide-slate-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine w="45%" h="12px" />
              <SkeletonLine w="30%" h="10px" />
            </div>
            <SkeletonLine w="80px" h="10px" />
          </div>
        ))}
      </div>
    </div>
  );
}