document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const applicationForm = document.getElementById('applicationForm');
  const neverWorkedCheckbox = document.getElementById('neverWorkedCheckbox');
  const pastChannelsInput = document.getElementById('pastChannels');
  const formError = document.getElementById('formError');
  const formErrorMessage = document.getElementById('formErrorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnIcon = document.getElementById('btnIcon');
  const btnSpinner = document.getElementById('btnSpinner');
  const successModal = document.getElementById('successModal');
  const modalCard = document.getElementById('modalCard');
  const modalAppId = document.getElementById('modalAppId');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Handle "Never worked before" checkbox toggle
  if (neverWorkedCheckbox && pastChannelsInput) {
    neverWorkedCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        pastChannelsInput.value = '';
        pastChannelsInput.disabled = true;
        pastChannelsInput.placeholder = 'Marked: Fresh talent with no previous channel clients. Ready to learn!';
        pastChannelsInput.classList.add('opacity-50', 'bg-dark-950');
      } else {
        pastChannelsInput.disabled = false;
        pastChannelsInput.placeholder = 'List YouTube channel links, Instagram handles, or client names you have edited for in the past...';
        pastChannelsInput.classList.remove('opacity-50', 'bg-dark-950');
      }
    });
  }

  // Hide error banner helper
  const hideError = () => {
    formError.classList.add('hidden');
    formErrorMessage.textContent = '';
  };

  // Show error banner helper
  const showError = (msg) => {
    formErrorMessage.textContent = msg;
    formError.classList.remove('hidden');
    formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (window.lucide) window.lucide.createIcons();
  };

  // Submit Handler
  if (applicationForm) {
    applicationForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      // Gather form values
      const formData = new FormData(applicationForm);
      const fullName = (formData.get('full_name') || '').trim();
      const addressCity = (formData.get('address_city') || '').trim();
      const experience = formData.get('experience');
      const neverWorked = formData.get('never_worked_before') ? true : false;
      const pastChannels = (formData.get('past_channels') || '').trim();
      const whatsapp = (formData.get('whatsapp') || '').trim();
      const altPhone = (formData.get('alt_phone') || '').trim();
      const telegram = (formData.get('telegram') || '').trim();
      const instagram = (formData.get('instagram') || '').trim();
      const taskLink = (formData.get('task_link') || '').trim();

      // Collect multiple skill checkboxes
      const skills = [];
      document.querySelectorAll('input[name="skills"]:checked').forEach(cb => {
        skills.push(cb.value);
      });

      // Front-end validations
      if (!fullName) {
        showError('Please enter your full name.');
        return;
      }

      if (!experience) {
        showError('Please select your video editing experience level.');
        return;
      }

      if (!whatsapp) {
        showError('Please enter your WhatsApp number with country code.');
        return;
      }

      // Simple phone format check
      const cleanedPhone = whatsapp.replace(/[^\d+]/g, '');
      if (cleanedPhone.length < 8) {
        showError('Please provide a complete WhatsApp number including country code (e.g. +1 555 0199 or +91 98765 43210).');
        return;
      }

      if (!taskLink) {
        showError('Please paste your edited task submission link (Google Drive or YouTube).');
        return;
      }

      if (!taskLink.startsWith('http://') && !taskLink.startsWith('https://')) {
        showError('The task submission link must start with https:// or http://');
        return;
      }

      // Payload
      const payload = {
        full_name: fullName,
        address_city: addressCity,
        experience,
        never_worked_before: neverWorked,
        past_channels: pastChannels,
        whatsapp: cleanedPhone,
        alt_phone: altPhone,
        telegram,
        instagram,
        skills,
        task_link: taskLink
      };

      // Set Loading State
      submitBtn.disabled = true;
      btnText.textContent = 'Submitting Application...';
      btnIcon.classList.add('hidden');
      btnSpinner.classList.remove('hidden');

      try {
        const response = await fetch('/api/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Submission failed. Please check your fields and try again.');
        }

        // Success!
        applicationForm.reset();
        if (neverWorkedCheckbox && pastChannelsInput) {
          pastChannelsInput.disabled = false;
          pastChannelsInput.classList.remove('opacity-50', 'bg-dark-950');
        }

        // Show Modal
        if (modalAppId) {
          modalAppId.textContent = `#APP-${data.applicationId || 'NEW'}`;
        }

        successModal.classList.remove('hidden');
        setTimeout(() => {
          modalCard.classList.remove('scale-95', 'opacity-0');
          modalCard.classList.add('scale-100', 'opacity-100');
        }, 10);

        if (window.lucide) window.lucide.createIcons();

      } catch (err) {
        showError(err.message || 'A network error occurred. Please try again.');
      } finally {
        // Reset button
        submitBtn.disabled = false;
        btnText.textContent = 'Submit Editor Application';
        btnIcon.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
      }
    });
  }

  // Close modal
  if (closeModalBtn && successModal) {
    closeModalBtn.addEventListener('click', () => {
      modalCard.classList.add('scale-95', 'opacity-0');
      modalCard.classList.remove('scale-100', 'opacity-100');
      setTimeout(() => {
        successModal.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 200);
    });
  }
});
