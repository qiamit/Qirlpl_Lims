import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Equipment } from '@/types'

const QUERY_KEY = 'equipment'

export function useEquipmentList() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('asset_code')
      if (error) throw error
      return data as Equipment[]
    },
  })
}

export function useEquipmentById(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*, calibration_records(*), maintenance_records(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Equipment
    },
    enabled: Boolean(id),
  })
}

export function useUpdateEquipmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Equipment['status'] }) => {
      const { data, error } = await supabase
        .from('equipment')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Equipment
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}
