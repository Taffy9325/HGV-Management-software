// Updated handleCreateUser function for invitation system
// Replace the existing function in app/admin/users/page.tsx

const handleCreateUser = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!supabase || !tenantId) return

  try {
    // Generate invitation token
    const invitationToken = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now
    
    // Create invitation record
    const { data: invitationData, error: invitationError } = await supabase
      .from('user_invitations')
      .insert({
        tenant_id: tenantId,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
        invited_by: userProfile?.id,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (invitationError) {
      console.error('Error creating invitation:', invitationError)
      alert('Error creating invitation: ' + invitationError.message)
      return
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
    
    // Generate invitation link
    const invitationLink = `${window.location.origin}/auth/invited-signup?token=${invitationToken}`
    
    alert(`Invitation sent successfully! Send this link to ${formData.email}:\n\n${invitationLink}`)
  } catch (error) {
    console.error('Error creating invitation:', error)
    alert('Error creating invitation')
  }
}
