import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ClientImportPage() {
  return <Navigate to="/clients?import=true" replace />;
}
