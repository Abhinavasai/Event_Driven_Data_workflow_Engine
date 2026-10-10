import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <p className="text-5xl font-bold text-slate-300">404</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">Page not found</h2>
      <p className="mt-2 text-sm text-slate-600">The page you requested does not exist in this console.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">
        Go to dashboard
      </Link>
    </div>
  );
}
