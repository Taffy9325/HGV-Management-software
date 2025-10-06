-- Alternative user creation approach
-- This creates a simpler user creation method that doesn't require admin API

const handleCreateUserAlternative = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!supabase || !tenantId) return

  try {
    // Generate a temporary UUID for the user
    const tempUserId = crypto.randomUUID()
    
    // Create user profile in our users table first
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: tempUserId,
        tenant_id: tenantId,
        email: formData.email,
        role: formData.role,
        profile: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: '',
          department: formData.role === 'admin' ? 'Administration' : 
                     formData.role === 'driver' ? 'Driving' : 'Maintenance'
        }
      })
      .select()
      .single()

    if (userError) {
      console.error('Error creating user profile:', userError)
      alert('Error creating user profile: ' + userError.message)
      return
    }

    // Create role-specific data
    if (formData.role === 'driver') {
      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          tenant_id: tenantId,
          user_id: tempUserId,
          licence_number: formData.licence_number,
          licence_expiry: formData.licence_expiry || null,
          cpc_expiry: formData.cpc_expiry || null,
          tacho_card_expiry: formData.tacho_card_expiry || null
        })

      if (driverError) {
        console.error('Error creating driver profile:', driverError)
        alert('Error creating driver profile: ' + driverError.message)
        return
      }
    } else if (formData.role === 'maintenance_provider') {
      const { error: maintenanceError } = await supabase
        .from('maintenance_providers')
        .insert({
          tenant_id: tenantId,
          user_id: tempUserId,
          company_name: formData.company_name,
          certification_number: formData.certification_number || null,
          certification_expiry: formData.certification_expiry || null,
          specializations: formData.specializations,
          contact_phone: formData.contact_phone || null,
          contact_email: formData.contact_email || null,
          address: formData.address
        })

      if (maintenanceError) {
        console.error('Error creating maintenance provider profile:', maintenanceError)
        alert('Error creating maintenance provider profile: ' + maintenanceError.message)
        return
      }
    }

    // Reset form and close modal
    setShowCreateForm(false)
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'driver',
      profile: {},
      licence_number: '',
      licence_expiry: '',
      cpc_expiry: '',
      tacho_card_expiry: '',
      company_name: '',
      certification_number: '',
      certification_expiry: '',
      specializations: [],
      contact_phone: '',
      contact_email: '',
      address: {}
    })
    fetchUsers()
    
    alert(`User created successfully! They will need to sign up with email: ${formData.email}`)
  } catch (error) {
    console.error('Error creating user:', error)
    alert('Error creating user')
  }
}
