import { RouterProvider } from 'react-router'
import { router } from './routes'
import { AppProvider, useApp } from './context/AppContext'
import { Toaster } from 'sonner'

function AppShell() {
  const { darkMode } = useApp()
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        theme={darkMode ? 'dark' : 'light'}
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 5000,
          style: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          },
        }}
      />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
