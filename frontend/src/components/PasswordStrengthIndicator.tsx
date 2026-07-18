import React from 'react';

interface PasswordCriteria {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
}

export const validatePassword = (password: string): PasswordCriteria => {
  return {
    length: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
};

export const isPasswordValid = (password: string): boolean => {
  const criteria = validatePassword(password);
  return Object.values(criteria).every(Boolean);
};

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const criteria = validatePassword(password);

  const renderCriterion = (isValid: boolean, text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isValid ? '#10b981' : '#ef4444', fontSize: '0.85rem' }}>
      <i className={isValid ? "ph-fill ph-check-circle" : "ph-fill ph-x-circle"} />
      <span>{text}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', marginBottom: '8px', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
      {renderCriterion(criteria.length, "10 caractères minimum")}
      {renderCriterion(criteria.uppercase, "Au moins une majuscule")}
      {renderCriterion(criteria.lowercase, "Au moins une minuscule")}
      {renderCriterion(criteria.number, "Au moins un chiffre")}
    </div>
  );
};

export default PasswordStrengthIndicator;
