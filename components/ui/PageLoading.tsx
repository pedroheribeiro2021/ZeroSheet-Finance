export default function PageLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-zinc-400">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
      <p className="text-sm">Carregando...</p>
    </div>
  );
}
