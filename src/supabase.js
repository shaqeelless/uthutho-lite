import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Auth helpers
export const signUp = async (email, password, fullName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  })
  
  if (data.user && !error) {
    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          first_name: fullName.split(' ')[0] || '',
          last_name: fullName.split(' ').slice(1).join(' ') || '',
        }
      ])
    
    if (profileError) console.error('Profile creation error:', profileError)
  }
  
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Data helpers
export const getRoutes = async () => {
  const { data, error } = await supabase
    .from('routes')
    .select(`
      *,
      hubs!routes_hub_id_fkey(name)
    `)
    .order('name')
  
  return { data, error }
}

export const getStops = async () => {
  const { data, error } = await supabase
    .from('stops')
    .select(`
      *,
      routes!stops_route_id_fkey(name, transport_type)
    `)
    .order('name')
  
  return { data, error }
}

export const getHubs = async () => {
  const { data, error } = await supabase
    .from('hubs')
    .select('*')
    .order('name')
  
  return { data, error }
}

// Favorites helpers
export const getFavorites = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('favorites')
    .eq('id', userId)
    .single()
  
  return { data: data?.favorites || [], error }
}

export const updateFavorites = async (userId, favorites) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ favorites })
    .eq('id', userId)
  
  return { data, error }
}