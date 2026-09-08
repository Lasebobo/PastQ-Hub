import { AuthProvider } from "./lib/AuthContext";
import { MainApp } from "./MainApp";

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
