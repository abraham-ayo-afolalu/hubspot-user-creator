export default function AdminTest() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Admin Test Page</h1>
        <p className="mt-2">If you can see this, the admin routing is working.</p>
        <p className="mt-2 text-sm text-gray-600">
          This means the issue might be with authentication or the main admin page.
        </p>
      </div>
    </div>
  );
}
