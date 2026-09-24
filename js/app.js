document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    const steps = appContainer.querySelectorAll('.form-step');
    const stepItems = appContainer.querySelectorAll('.step-item');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnSubmit = document.getElementById('btn-submit');
    let currentStep = 1;
    const totalSteps = steps.length;

    // Hide/show end-date based on contract type
    const contractRadios = document.querySelectorAll('input[name="contract-type"]');
    const endDateGroup = document.getElementById('end-date-group');
    const contractTypeOtherInput = document.getElementById('contract-type-other');
    contractRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'CDI') {
                endDateGroup.style.display = 'none';
                document.getElementById('end-date').value = '';
            } else {
                endDateGroup.style.display = '';
            }
            if (contractTypeOtherInput) {
                contractTypeOtherInput.style.display = radio.value === 'Autre' ? 'block' : 'none';
            }
        });
    });

    // Navigation
    function goToStep(step) {
        if (step < 1 || step > totalSteps) return;

        // Hide current step
        document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.remove('active');
        document.querySelector(`.step-item[data-step="${currentStep}"]`).classList.remove('active');
        document.querySelector(`.step-item[data-step="${currentStep}"]`).classList.add('completed');

        // Show new step
        currentStep = step;
        document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.remove('active');
        document.querySelector(`.form-step[data-step="${currentStep}"]`).classList.add('active');
        
        // Update sidebar
        stepItems.forEach(item => {
            const itemStep = parseInt(item.dataset.step);
            item.classList.remove('active');
            if (itemStep < currentStep) {
                item.classList.add('completed');
            } else if (itemStep === currentStep) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('completed');
            }
        });

        // Update buttons
        btnPrev.disabled = currentStep === 1;
        if (currentStep === totalSteps) {
            btnNext.style.display = 'none';
            btnSubmit.style.display = 'inline-flex';
            generateSummary();
        } else {
            btnNext.style.display = 'inline-flex';
            btnSubmit.style.display = 'none';
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    btnNext.addEventListener('click', () => {
        if (validateCurrentStep()) {
            goToStep(currentStep + 1);
        }
    });

    btnPrev.addEventListener('click', () => {
        goToStep(currentStep - 1);
    });

    // Click on sidebar steps
    stepItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetStep = parseInt(item.dataset.step);
            if (targetStep < currentStep || validateCurrentStep()) {
                goToStep(targetStep);
            }
        });
    });

    // Validation
    function validateCurrentStep() {
        const currentStepEl = document.querySelector(`.form-step[data-step="${currentStep}"]`);
        const requiredInputs = currentStepEl.querySelectorAll('input[required], textarea[required]');
        let valid = true;

        requiredInputs.forEach(input => {
            if (!input.value.trim()) {
                input.style.borderColor = '#e74c3c';
                valid = false;
                input.addEventListener('input', () => {
                    input.style.borderColor = '';
                }, { once: true });
            }
        });

        // Check required radio groups and selects in step 2
        if (currentStep === 2) {
            const contractType = document.querySelector('input[name="contract-type"]:checked');
            const jobTitle = document.getElementById('job-title');
            const country = document.getElementById('workplace-country');
            const city = document.getElementById('workplace-city');
            
            if (!contractType) {
                valid = false;
                highlightRadioGroup('contract-type');
            }
            if (!jobTitle.value) {
                valid = false;
                jobTitle.style.borderColor = '#e74c3c';
                jobTitle.addEventListener('change', () => { jobTitle.style.borderColor = ''; }, { once: true });
            }
            if (!country.value) {
                valid = false;
                country.style.borderColor = '#e74c3c';
                country.addEventListener('change', () => { country.style.borderColor = ''; }, { once: true });
            }
            if (!city.value) {
                valid = false;
                city.style.borderColor = '#e74c3c';
                city.addEventListener('change', () => { city.style.borderColor = ''; }, { once: true });
            }
        }

        if (!valid) {
            showToast('Veuillez remplir tous les champs obligatoires');
        }

        return valid;
    }

    function highlightRadioGroup(name) {
        const cards = document.querySelectorAll(`input[name="${name}"]`);
        cards.forEach(input => {
            const content = input.nextElementSibling;
            if (content) {
                content.style.borderColor = '#e74c3c';
                input.addEventListener('change', () => {
                    document.querySelectorAll(`input[name="${name}"]`).forEach(i => {
                        const c = i.nextElementSibling;
                        if (c) c.style.borderColor = '';
                    });
                }, { once: true });
            }
        });
    }

    // Toast notification
    function showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: #e74c3c;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Tableau checkbox conditional
    const tableauCheckbox = document.querySelector('input[name="apps-dsi"][value="Tableau"]');
    if (tableauCheckbox) {
        tableauCheckbox.addEventListener('change', () => {
            const emailGroup = document.getElementById('tableau-email-group');
            emailGroup.style.display = tableauCheckbox.checked ? 'block' : 'none';
        });
    }

    // Job title "Autre" handling
    const jobSelect = document.getElementById('job-title');
    const jobOtherInput = document.getElementById('job-title-other');
    if (jobSelect && jobOtherInput) {
        jobSelect.addEventListener('change', () => {
            jobOtherInput.style.display = jobSelect.value === 'Autre' ? 'block' : 'none';
        });
    }

    // Country/City cascade
    const citiesByCountry = {
        'France': ['Gentilly', 'Nantes', 'Grenoble', 'Autre'],
        'Roumanie': ['Bucarest', 'Autre'],
        'Allemagne': ['Berlin', 'Hambourg', 'Autre'],
        'Hollande': ['Amsterdam', 'Autre'],
        'Espagne': ['Madrid', 'Autre'],
        'Italie': ['Milan', 'Autre'],
    };

    const countrySelect = document.getElementById('workplace-country');
    const citySelect = document.getElementById('workplace-city');
    const cityOtherInput = document.getElementById('workplace-city-other');
    const countryOtherInput = document.getElementById('workplace-country-other');

    if (countrySelect && citySelect) {
        countrySelect.addEventListener('change', () => {
            const country = countrySelect.value;
            
            // Handle "Autre" country
            if (country === 'Autre') {
                countryOtherInput.style.display = 'block';
                citySelect.innerHTML = '<option value="" disabled selected>Sélectionner une ville...</option><option value="Autre">Autre</option>';
                citySelect.disabled = false;
                cityOtherInput.style.display = 'block';
                return;
            } else {
                countryOtherInput.style.display = 'none';
                countryOtherInput.value = '';
            }
            
            const cities = citiesByCountry[country] || [];
            citySelect.innerHTML = '<option value="" disabled selected>Sélectionner une ville...</option>';
            cities.forEach(city => {
                const opt = document.createElement('option');
                opt.value = city;
                opt.textContent = city;
                citySelect.appendChild(opt);
            });
            citySelect.disabled = false;
            cityOtherInput.style.display = 'none';
            cityOtherInput.value = '';
        });

        citySelect.addEventListener('change', () => {
            if (citySelect.value === 'Autre') {
                cityOtherInput.style.display = 'block';
                cityOtherInput.focus();
            } else {
                cityOtherInput.style.display = 'none';
                cityOtherInput.value = '';
            }
        });
    }

    // Laptop toggle
    document.querySelectorAll('input[name="laptop-needed"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const details = document.getElementById('laptop-details');
            details.style.display = radio.value === 'Oui' && radio.checked ? 'block' : 'none';
        });
    });

    // Mailing list add button
    document.getElementById('btn-add-mailing').addEventListener('click', () => {
        const container = document.getElementById('mailing-list-container');
        const entry = document.createElement('div');
        entry.className = 'mailing-list-entry';
        entry.innerHTML = '<input type="email" name="mailing-lists[]" placeholder="Ex: team-dev@recommerce.com"><button type="button" class="btn-remove-mailing" title="Supprimer"><span class="material-icons">close</span></button>';
        entry.querySelector('.btn-remove-mailing').addEventListener('click', () => entry.remove());
        container.appendChild(entry);
    });

    // Generate Summary
    function generateSummary() {
        const container = document.getElementById('summary-content');
        container.innerHTML = '';

        // Personal info
        const personalSection = createSummarySection('Informations personnelles', [
            { label: 'Prénom', value: document.getElementById('firstname').value, edit: { type: 'text', target: 'firstname' } },
            { label: 'Nom', value: document.getElementById('lastname').value, edit: { type: 'text', target: 'lastname' } },
            { label: 'Email personnel', value: document.getElementById('personal-email').value, edit: { type: 'text', target: 'personal-email', inputType: 'email' } },
            { label: 'Email professionnel', value: document.getElementById('pro-email').value || '-', edit: { type: 'text', target: 'pro-email', inputType: 'email' } },
            { label: "Date d'arrivée", value: formatDate(document.getElementById('start-date').value), edit: { type: 'text', target: 'start-date', inputType: 'date' } },
            { label: 'Date de fin', value: formatDate(document.getElementById('end-date').value) || 'Non définie', edit: { type: 'text', target: 'end-date', inputType: 'date' } },
        ], 1);
        container.appendChild(personalSection);

        // Contract
        const contractType = document.querySelector('input[name="contract-type"]:checked');
        const contractTypeRaw = contractType ? contractType.value : '';
        let contractTypeValue = contractTypeRaw;
        let contractTypeEdit;
        if (contractTypeRaw === 'Autre') {
            contractTypeValue = document.getElementById('contract-type-other').value || 'Autre';
            contractTypeEdit = { type: 'text', target: 'contract-type-other' };
        } else {
            contractTypeEdit = { type: 'radio', target: 'contract-type', options: getRadioOptions('contract-type') };
        }

        const jobTitleEl = document.getElementById('job-title');
        const jobRaw = jobTitleEl.value;
        let jobValue = jobRaw;
        let jobEdit;
        if (jobRaw === 'Autre') {
            jobValue = document.getElementById('job-title-other').value || 'Autre';
            jobEdit = { type: 'text', target: 'job-title-other' };
        } else {
            jobEdit = { type: 'select', target: 'job-title' };
        }

        const countryVal = document.getElementById('workplace-country').value || '';
        let countryValue = countryVal;
        let countryEdit;
        if (countryVal === 'Autre') {
            countryValue = document.getElementById('workplace-country-other').value || 'Autre';
            countryEdit = { type: 'text', target: 'workplace-country-other' };
        } else {
            countryEdit = { type: 'select', target: 'workplace-country' };
        }

        const cityVal = document.getElementById('workplace-city').value || '';
        let cityValue = cityVal;
        let cityEdit;
        if (cityVal === 'Autre') {
            cityValue = document.getElementById('workplace-city-other').value || 'Autre';
            cityEdit = { type: 'text', target: 'workplace-city-other' };
        } else {
            cityEdit = { type: 'select', target: 'workplace-city' };
        }

        const contractSection = createSummarySection('Contrat & Poste', [
            { label: 'Type de contrat', value: contractTypeValue, edit: contractTypeEdit },
            { label: 'Métier', value: jobValue, edit: jobEdit },
            { label: 'Pays', value: countryValue || 'Non défini', edit: countryEdit },
            { label: 'Ville', value: cityValue || 'Non défini', edit: cityEdit },
        ], 2);
        container.appendChild(contractSection);

        // Material
        const laptopNeeded = document.querySelector('input[name="laptop-needed"]:checked');
        const laptopProfile = document.querySelector('input[name="laptop-profile"]:checked');
        const laptopOs = document.querySelector('input[name="laptop-os"]:checked');
        const headsetNeeded = document.querySelector('input[name="headset-needed"]:checked');
        const deskMaterials = getCheckedValues('desk-material');
        const materialRows = [
            { label: 'Laptop', value: laptopNeeded ? laptopNeeded.value : 'Non précisé', edit: { type: 'radio', target: 'laptop-needed', options: getRadioOptions('laptop-needed') } },
        ];
        if (laptopNeeded && laptopNeeded.value === 'Oui') {
            materialRows.push({ label: 'Profil laptop', value: laptopProfile ? laptopProfile.value : 'Non défini', edit: { type: 'radio', target: 'laptop-profile', options: getRadioOptions('laptop-profile') } });
            materialRows.push({ label: 'OS', value: laptopOs ? laptopOs.value : 'Non défini', edit: { type: 'radio', target: 'laptop-os', options: getRadioOptions('laptop-os') } });
        }
        materialRows.push({ label: 'Casque', value: headsetNeeded ? headsetNeeded.value : 'Non précisé', edit: { type: 'radio', target: 'headset-needed', options: getRadioOptions('headset-needed') } });
        materialRows.push({ label: 'Matériel bureau', value: deskMaterials.join(', ') || 'Aucun', edit: { type: 'checkbox', target: 'desk-material', options: getRadioOptions('desk-material'), values: deskMaterials } });
        const materialSection = createSummarySection('Matériel', materialRows, 3);
        container.appendChild(materialSection);

        // Applications
        const allApps = [
            ...getCheckedValues('apps-finance'),
            ...getCheckedValues('apps-achats'),
            ...getCheckedValues('apps-ventes'),
            ...getCheckedValues('apps-pricing'),
            ...getCheckedValues('apps-dsi'),
            ...getCheckedValues('apps-transverses'),
        ];
        const appsSection = createSummarySection('Applications', null, 4);
        if (allApps.length > 0) {
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'summary-tags';
            allApps.forEach(app => {
                const tag = document.createElement('span');
                tag.className = 'summary-tag';
                tag.textContent = app;
                tagsDiv.appendChild(tag);
            });
            appsSection.appendChild(tagsDiv);
        } else {
            const row = document.createElement('div');
            row.className = 'summary-row';
            row.innerHTML = '<span class="label">Applications</span><span class="value">Aucune sélectionnée</span>';
            appsSection.appendChild(row);
        }
        container.appendChild(appsSection);

        // Mailing Lists
        const mailingInputs = document.querySelectorAll('input[name="mailing-lists[]"]');
        const mailingValues = Array.from(mailingInputs).map(i => i.value.trim()).filter(v => v);
        const mlRows = [
            { label: 'Mailing list(s)', value: mailingValues.length > 0 ? mailingValues.join(', ') : 'Aucune' },
        ];
        const mlSection = createSummarySection('Mailing List', mlRows, 5);
        container.appendChild(mlSection);
    }

    function createSummarySection(title, rows, step) {
        const section = document.createElement('div');
        section.className = 'summary-section';
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.appendChild(heading);
        if (rows) {
            rows.forEach(row => {
                const rowEl = document.createElement('div');
                rowEl.className = 'summary-row';

                const labelEl = document.createElement('span');
                labelEl.className = 'label';
                labelEl.textContent = row.label;
                rowEl.appendChild(labelEl);

                if (row.edit) {
                    rowEl.classList.add('summary-row--editable');
                    rowEl.appendChild(createEditableValue(row));
                } else {
                    const valueEl = document.createElement('span');
                    valueEl.className = 'value';
                    valueEl.textContent = row.value || '-';
                    rowEl.appendChild(valueEl);
                }

                section.appendChild(rowEl);
            });
        }
        if (step) {
            section.classList.add('summary-section--clickable');
            section.title = 'Cliquer pour modifier cette étape';
            section.addEventListener('click', () => goToStep(step));
        }
        return section;
    }

    // Builds a value span that turns into an inline editor matching the field's original choices
    function createEditableValue(row) {
        const valueEl = document.createElement('span');
        valueEl.className = 'value summary-value--editable';
        valueEl.textContent = row.value || '-';
        valueEl.title = 'Cliquer pour modifier cette valeur';
        valueEl.addEventListener('click', (event) => {
            event.stopPropagation();
            openInlineEditor(valueEl, row);
        });
        return valueEl;
    }

    function openInlineEditor(valueEl, row) {
        const edit = row.edit;
        const wrapper = document.createElement('span');
        wrapper.className = 'summary-inline-editor';
        wrapper.addEventListener('click', (event) => event.stopPropagation());

        if (edit.type === 'checkbox') {
            const optionsWrap = document.createElement('div');
            optionsWrap.className = 'summary-inline-checkboxes';
            edit.options.forEach(opt => {
                const label = document.createElement('label');
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = opt.value;
                cb.checked = edit.values.includes(opt.value);
                label.appendChild(cb);
                label.appendChild(document.createTextNode(' ' + opt.label));
                optionsWrap.appendChild(label);
            });
            const confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.className = 'summary-inline-confirm';
            confirmBtn.textContent = 'OK';
            confirmBtn.addEventListener('click', () => {
                const values = Array.from(optionsWrap.querySelectorAll('input:checked')).map(cb => cb.value);
                document.querySelectorAll(`input[name="${edit.target}"]`).forEach(cb => {
                    cb.checked = values.includes(cb.value);
                });
                generateSummary();
            });
            wrapper.appendChild(optionsWrap);
            wrapper.appendChild(confirmBtn);
            valueEl.replaceWith(wrapper);
            return;
        }

        let control;
        if (edit.type === 'select') {
            const sourceSelect = document.getElementById(edit.target);
            control = document.createElement('select');
            control.innerHTML = sourceSelect.innerHTML;
            control.value = sourceSelect.value;
        } else if (edit.type === 'radio') {
            control = document.createElement('select');
            edit.options.forEach(opt => {
                const optionEl = document.createElement('option');
                optionEl.value = opt.value;
                optionEl.textContent = opt.label;
                control.appendChild(optionEl);
            });
            const checked = document.querySelector(`input[name="${edit.target}"]:checked`);
            control.value = checked ? checked.value : '';
        } else {
            control = document.createElement('input');
            control.type = edit.inputType || 'text';
            const sourceEl = document.getElementById(edit.target);
            control.value = sourceEl.value;
        }
        control.className = 'summary-inline-control';
        wrapper.appendChild(control);
        valueEl.replaceWith(wrapper);
        control.focus();
        if (control.select) control.select();

        const commit = () => {
            if (edit.type === 'select') {
                const sourceSelect = document.getElementById(edit.target);
                sourceSelect.value = control.value;
                sourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (edit.type === 'radio') {
                const radio = document.querySelector(`input[name="${edit.target}"][value="${CSS.escape(control.value)}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                const sourceEl = document.getElementById(edit.target);
                sourceEl.value = control.value;
                sourceEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
            generateSummary();
        };

        let committed = false;
        const commitOnce = () => {
            if (committed) return;
            committed = true;
            commit();
        };

        control.addEventListener('blur', commitOnce);
        if (edit.type === 'select' || edit.type === 'radio') {
            control.addEventListener('change', commitOnce);
        }
        control.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitOnce();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                committed = true;
                generateSummary();
            }
        });
    }

    function getRadioOptions(name) {
        return Array.from(document.querySelectorAll(`input[name="${name}"]`)).map(input => {
            const content = input.nextElementSibling;
            return { value: input.value, label: content ? content.textContent.trim() : input.value };
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function getCheckedValues(name) {
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // Submit
    btnSubmit.addEventListener('click', async () => {
        const formData = collectFormData();
        console.log('Form submitted:', formData);
        
        // Save submission
        if (typeof Submissions !== 'undefined') {
            Submissions.add(formData);
        }

        // Disable button during send
        btnSubmit.disabled = true;
        btnSubmit.classList.add('is-loading');
        btnSubmit.innerHTML = '<span class="material-icons">hourglass_top</span> Envoi en cours...';

        // Send email via backend
        let emailSent = false;
        try {
            const response = await fetch('/api/send-onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const result = await response.json();
            emailSent = result.success;
            if (!emailSent) {
                console.error('Email error:', result.message);
            }
        } catch (err) {
            console.error('Network error:', err);
        }

        // Show success
        const container = document.querySelector('.form-container');
        container.innerHTML = `
            <div class="success-message">
                <span class="material-icons">check_circle</span>
                <h2>Demande envoyée avec succès !</h2>
                <p>L'onboarding de <strong>${escapeHtml(formData.firstname)} ${escapeHtml(formData.lastname)}</strong> a bien été enregistré.</p>
                ${emailSent
                    ? '<p style="color: #2e7d32;"><span class="material-icons" style="vertical-align: middle; font-size: 18px;">email</span> Un email récapitulatif a été envoyé.</p>'
                    : '<p style="color: #e65100;"><span class="material-icons" style="vertical-align: middle; font-size: 18px;">warning</span> L\'email n\'a pas pu être envoyé, mais la demande a été enregistrée.</p>'
                }
                <button class="btn btn-primary" style="margin-top: 2rem;" onclick="location.reload()">
                    Nouveau formulaire
                </button>
            </div>
        `;
    });

    function collectFormData() {
        const countryVal = document.getElementById('workplace-country').value || '';
        const cityVal = document.getElementById('workplace-city').value || '';
        let workplaceValue = countryVal === 'Autre'
            ? (document.getElementById('workplace-country-other').value || 'Autre')
            : countryVal;
        if (cityVal === 'Autre') {
            workplaceValue += ' - ' + (document.getElementById('workplace-city-other').value || '');
        } else if (cityVal) {
            workplaceValue += ' - ' + cityVal;
        }

        let jobValue = document.getElementById('job-title').value;
        if (jobValue === 'Autre') {
            jobValue = document.getElementById('job-title-other').value || 'Autre';
        }

        let contractTypeValue = document.querySelector('input[name="contract-type"]:checked')?.value || '';
        if (contractTypeValue === 'Autre') {
            contractTypeValue = document.getElementById('contract-type-other').value || 'Autre';
        }

        return {
            firstname: document.getElementById('firstname').value,
            lastname: document.getElementById('lastname').value,
            personalEmail: document.getElementById('personal-email').value,
            proEmail: document.getElementById('pro-email').value,
            startDate: document.getElementById('start-date').value,
            endDate: document.getElementById('end-date').value,
            contractType: contractTypeValue,
            jobTitle: jobValue,
            workplace: workplaceValue,
            laptopNeeded: document.querySelector('input[name="laptop-needed"]:checked')?.value || '',
            laptopProfile: document.querySelector('input[name="laptop-profile"]:checked')?.value || '',
            laptopOs: document.querySelector('input[name="laptop-os"]:checked')?.value || '',
            headsetNeeded: document.querySelector('input[name="headset-needed"]:checked')?.value || '',
            deskMaterial: getCheckedValues('desk-material'),
            appsFinance: getCheckedValues('apps-finance'),
            appsAchats: getCheckedValues('apps-achats'),
            appsVentes: getCheckedValues('apps-ventes'),
            appsPricing: getCheckedValues('apps-pricing'),
            appsDsi: getCheckedValues('apps-dsi'),
            appsTransverses: getCheckedValues('apps-transverses'),
            tableauEmail: document.getElementById('tableau-email')?.value || '',
            mailingLists: Array.from(document.querySelectorAll('input[name="mailing-lists[]"]')).map(i => i.value.trim()).filter(v => v),
        };
    }

    // ===== Material Request Multi-Step Navigation =====
    const matContainer = document.getElementById('material-container');
    if (matContainer) {
        const matSteps = matContainer.querySelectorAll('.form-step');
        const matStepItems = matContainer.querySelectorAll('.step-item');
        const btnMatPrev = document.getElementById('btn-mat-prev');
        const btnMatNext = document.getElementById('btn-mat-next');
        const btnSubmitMat = document.getElementById('btn-submit-material');
        let currentMatStep = 1;
        const totalMatSteps = matSteps.length;

        function goToMatStep(step) {
            if (step < 1 || step > totalMatSteps) return;

            matContainer.querySelector(`.form-step[data-mat-step="${currentMatStep}"]`).classList.remove('active');
            currentMatStep = step;
            matContainer.querySelector(`.form-step[data-mat-step="${currentMatStep}"]`).classList.add('active');

            // Update sidebar
            matStepItems.forEach(item => {
                const itemStep = parseInt(item.dataset.matStep);
                item.classList.remove('active', 'completed');
                if (itemStep < currentMatStep) {
                    item.classList.add('completed');
                } else if (itemStep === currentMatStep) {
                    item.classList.add('active');
                }
            });

            // Update buttons
            btnMatPrev.disabled = currentMatStep === 1;
            if (currentMatStep === totalMatSteps) {
                btnMatNext.style.display = 'none';
                btnSubmitMat.style.display = 'inline-flex';
            } else {
                btnMatNext.style.display = 'inline-flex';
                btnSubmitMat.style.display = 'none';
            }
        }

        btnMatNext.addEventListener('click', () => {
            // Validate current step
            if (currentMatStep === 1) {
                const firstname = document.getElementById('mat-firstname');
                const lastname = document.getElementById('mat-lastname');
                const email = document.getElementById('mat-email');
                let valid = true;
                [firstname, lastname, email].forEach(input => {
                    if (!input.value.trim()) {
                        input.style.borderColor = '#e74c3c';
                        valid = false;
                        input.addEventListener('input', () => { input.style.borderColor = ''; }, { once: true });
                    }
                });
                if (!valid) return;
            }
            if (currentMatStep === 2) {
                const typeSelected = document.querySelector('input[name="material-type"]:checked');
                if (!typeSelected) {
                    highlightRadioGroup('material-type');
                    return;
                }
            }
            if (currentMatStep === 3) {
                const reasonSelected = document.querySelector('input[name="material-reason"]:checked');
                const itemsSelected = document.querySelectorAll('input[name="material-items"]:checked');
                if (!reasonSelected) {
                    highlightRadioGroup('material-reason');
                    return;
                }
                if (itemsSelected.length === 0) {
                    alert('Veuillez sélectionner au moins un élément de matériel.');
                    return;
                }
            }
            goToMatStep(currentMatStep + 1);
        });

        btnMatPrev.addEventListener('click', () => {
            goToMatStep(currentMatStep - 1);
        });

        matStepItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetStep = parseInt(item.dataset.matStep);
                if (targetStep <= currentMatStep) {
                    goToMatStep(targetStep);
                }
            });
        });

        // Material submit
        btnSubmitMat.addEventListener('click', async () => {
            const matData = {
                firstname: document.getElementById('mat-firstname').value.trim(),
                lastname: document.getElementById('mat-lastname').value.trim(),
                email: document.getElementById('mat-email').value.trim(),
                type: document.querySelector('input[name="material-type"]:checked')?.value || '',
                reason: document.querySelector('input[name="material-reason"]:checked')?.value || '',
                items: Array.from(document.querySelectorAll('input[name="material-items"]:checked')).map(i => i.value),
                comment: document.getElementById('material-comment').value.trim(),
            };

            // Send email (server also saves to DB)
            btnSubmitMat.disabled = true;
            btnSubmitMat.classList.add('is-loading');

            let emailSent = false;
            try {
                const response = await fetch('/api/send-material', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(matData),
                });
                const result = await response.json();
                emailSent = result.success;
            } catch (err) {
                console.error('Network error:', err);
            }

            // Show success
            const formContainer = matContainer.querySelector('.form-container');
            formContainer.innerHTML = `
                <div class="success-message">
                    <span class="material-icons">check_circle</span>
                    <h2>Demande envoyée !</h2>
                    <p>Votre demande de matériel a bien été enregistrée.</p>
                    ${emailSent
                        ? '<p style="color: #2e7d32;"><span class="material-icons" style="vertical-align: middle; font-size: 18px;">email</span> Un email récapitulatif vous a été envoyé.</p>'
                        : '<p style="color: #e65100;"><span class="material-icons" style="vertical-align: middle; font-size: 18px;">warning</span> L\'email n\'a pas pu être envoyé, mais la demande a été enregistrée.</p>'
                    }
                    <button class="btn btn-primary btn-back-home" style="margin-top: 1.5rem;">
                        <span class="material-icons">home</span> Retour à l'accueil
                    </button>
                </div>
            `;
            formContainer.querySelector('.btn-back-home').addEventListener('click', () => {
                window.location.reload();
            });
        });
    }

    // ===== Licence Form =====
    const licenceContainer = document.getElementById('licence-container');
    if (licenceContainer) {
        // Show licence form from home
        const btnGoLicence = document.getElementById('btn-go-licence');
        if (btnGoLicence) {
            btnGoLicence.addEventListener('click', () => {
                document.getElementById('home-screen').style.display = 'none';
                licenceContainer.style.display = 'flex';
            });
        }

        // Auto-advance between key segments
        const segments = licenceContainer.querySelectorAll('.licence-key-segment');
        segments.forEach((seg, i) => {
            seg.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (e.target.value.length === 5 && i < segments.length - 1) {
                    segments[i + 1].focus();
                }
            });
            seg.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && e.target.value === '' && i > 0) {
                    segments[i - 1].focus();
                }
            });
            // Handle paste of full key
            seg.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (pasted.length >= 25) {
                    for (let j = 0; j < 5; j++) {
                        segments[j].value = pasted.substr(j * 5, 5);
                    }
                    segments[4].focus();
                } else {
                    e.target.value = pasted.substr(0, 5);
                    if (pasted.length === 5 && i < segments.length - 1) {
                        segments[i + 1].focus();
                    }
                }
            });
        });

        // Copy key
        document.getElementById('btn-copy-key').addEventListener('click', () => {
            const fullKey = Array.from(segments).map(s => s.value).join('-');
            if (fullKey.replace(/-/g, '').length < 25) return;
            navigator.clipboard.writeText(fullKey).then(() => {
                const btn = document.getElementById('btn-copy-key');
                btn.classList.add('copied');
                btn.querySelector('.material-icons').textContent = 'check';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.querySelector('.material-icons').textContent = 'content_copy';
                }, 2000);
            });
        });

        // Submit licence
        document.getElementById('btn-submit-licence').addEventListener('click', () => {
            const typeRadio = document.querySelector('input[name="licence-type"]:checked');
            if (!typeRadio) {
                highlightRadioGroup('licence-type');
                return;
            }

            const fullKey = Array.from(segments).map(s => s.value).join('-');
            if (fullKey.replace(/-/g, '').length < 25) {
                segments[0].style.borderColor = '#e74c3c';
                return;
            }

            const count = parseInt(document.getElementById('licence-count').value) || 1;

            const licence = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                type: typeRadio.value,
                key: fullKey,
                totalUses: count,
                usedCount: 0,
                addedAt: new Date().toISOString(),
            };

            // Save to localStorage
            const licences = JSON.parse(localStorage.getItem('licences') || '[]');
            licences.push(licence);
            localStorage.setItem('licences', JSON.stringify(licences));

            // Show success
            const formContainer = licenceContainer.querySelector('.form-container');
            formContainer.innerHTML = `
                <div class="success-message">
                    <span class="material-icons">check_circle</span>
                    <h2>Licence enregistrée !</h2>
                    <p>La clé <strong>${fullKey}</strong> a été ajoutée avec <strong>${count}</strong> utilisation(s) disponible(s).</p>
                    <button class="btn btn-primary btn-back-home" style="margin-top: 1.5rem;">
                        <span class="material-icons">home</span> Retour à l'accueil
                    </button>
                </div>
            `;
            formContainer.querySelector('.btn-back-home').addEventListener('click', () => {
                window.location.reload();
            });
        });
    }
});
