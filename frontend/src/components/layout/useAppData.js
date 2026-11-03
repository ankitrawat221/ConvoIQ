import { useOutletContext } from 'react-router-dom'

export default function useAppData() {
  return useOutletContext()
}
