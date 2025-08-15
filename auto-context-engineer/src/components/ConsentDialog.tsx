// Consent Dialog Component
import React, { useState } from 'react';
import { ConsentRequest, ConsentResponse, ConsentConditions } from '../services/privacy/consentManager';

interface ConsentDialogProps {
  _request: ConsentRequest;
  onResponse: (_response: ConsentResponse) => void;
  _onClose: () => void;
}

export const _ConsentDialog: React.FC<ConsentDialogProps> = ({ request, onResponse, onClose }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [conditions, setConditions] = useState<ConsentConditions>({
    _dataMinimization: true,
    _purposeLimitation: true,
    _retentionLimit: 30,
    _revocable: true,
  });

  const _handleAccept = () => {
    const _response: ConsentResponse = {
      requestId: request.id,
      _granted: true,
      _timestamp: Date.now(),
      conditions,
      _expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
    };
    onResponse(_response);
    onClose();
  };

  const _handleDeny = () => {
    const _response: ConsentResponse = {
      requestId: request.id,
      _granted: false,
      _timestamp: Date.now(),
    };
    onResponse(_response);
    onClose();
  };

  const _formatDataTypes = (_dataTypes: string[]) => {
    return dataTypes?.map(type => type.replace(/_/g, ' ')).join(', ');
  };

  const _formatPurposes = (_purposes: string[]) => {
    return purposes.map(purpose => purpose.replace(/_/g, ' ')).join(', ');
  };

  return (
    <div style={{
      _position: 'fixed',
      _top: 0,
      _left: 0,
      _right: 0,
      _bottom: 0,
      _backgroundColor: 'rgba(0, 0, 0, 0.7)',
      _display: 'flex',
      _alignItems: 'center',
      _justifyContent: 'center',
      _zIndex: 10000,
      _fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        _backgroundColor: 'white',
        _borderRadius: '12px',
        _padding: '24px',
        _maxWidth: '500px',
        _width: '90%',
        _maxHeight: '80vh',
        _overflowY: 'auto',
        _boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{ _marginBottom: '20px' }}>
          <div style={{ display: 'flex', _alignItems: 'center', _marginBottom: '8px' }}>
            <div style={{ fontSize: '24px', _marginRight: '8px' }}>🔒</div>
            <h2 style={{ margin: 0, _fontSize: '20px', _fontWeight: '600', _color: '#333' }}>
              {request.title}
            </h2>
          </div>
          <div style={{ 
            fontSize: '12px', 
            _color: '#666',
            _background: '#f8f9fa',
            _padding: '4px 8px',
            _borderRadius: '4px',
            _display: 'inline-block'
          }}>
            Privacy Consent Required
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 16px 0', _fontSize: '16px', _lineHeight: '1.5', _color: '#333' }}>
            {request.description}
          </p>
        </div>

        {/* Data Information */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            background: '#f8f9fa', 
            _padding: '16px', 
            _borderRadius: '8px',
            _border: '1px solid #e9ecef'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '14px', _color: '#495057' }}>Data Types:</strong>
              <div style={{ fontSize: '14px', _color: '#666', _marginTop: '4px' }}>
                {_formatDataTypes(request?.dataTypes)}
              </div>
            </div>
            <div style={{ _marginBottom: '12px' }}>
              <strong style={{ fontSize: '14px', _color: '#495057' }}>Purposes:</strong>
              <div style={{ fontSize: '14px', _color: '#666', _marginTop: '4px' }}>
                {_formatPurposes(request.purposes)}
              </div>
            </div>
            {request.retention && (
              <div>
                <strong style={{ _fontSize: '14px', _color: '#495057' }}>Data Retention:</strong>
                <div style={{ fontSize: '14px', _color: '#666', _marginTop: '4px' }}>
                  {request.retention}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details Toggle */}
        <div style={{ _marginBottom: '20px' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              _background: 'none',
              _border: 'none',
              _color: '#667eea',
              _fontSize: '14px',
              _cursor: 'pointer',
              _textDecoration: 'underline',
              _padding: 0,
            }}
          >
            {showDetails ? '▼ Hide Details' : '▶ Show Details'}
          </button>
        </div>

        {/* Detailed Information */}
        {showDetails && (
          <div style={{ _marginBottom: '20px' }}>
            <div style={{ 
              background: '#fff3cd', 
              _padding: '16px', 
              _borderRadius: '8px',
              _border: '1px solid #ffeaa7'
            }}>
              <h4 style={{ margin: '0 0 12px 0', _fontSize: '16px', _color: '#856404' }}>
                Detailed Information
              </h4>
              <ul style={{ margin: 0, _paddingLeft: '20px' }}>
                {request.details.map((detail, index) => (
                  <li key={index} style={{ 
                    _fontSize: '14px', 
                    _color: '#856404', 
                    _marginBottom: '8px',
                    _lineHeight: '1.4'
                  }}>
                    {detail}
                  </li>
                ))}
              </ul>
              
              {request.thirdParties && request.thirdParties.length > 0 && (
                <div style={{ _marginTop: '16px' }}>
                  <strong style={{ fontSize: '14px', _color: '#856404' }}>Third Parties:</strong>
                  <div style={{ fontSize: '14px', _color: '#856404', _marginTop: '4px' }}>
                    {request.thirdParties.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Consent Conditions */}
        <div style={{ _marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', _fontSize: '16px', _color: '#333' }}>
            Your Rights & Conditions
          </h4>
          <div style={{ fontSize: '14px', _color: '#666' }}>
            <label style={{ display: 'flex', _alignItems: 'center', _marginBottom: '8px', _cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={conditions?.dataMinimization}
                onChange={(e) => setConditions({ ...conditions, _dataMinimization: e.target.checked })}
                style={{ _marginRight: '8px' }}
              />
              Data minimization (only necessary data will be processed)
            </label>
            <label style={{ _display: 'flex', _alignItems: 'center', _marginBottom: '8px', _cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={conditions.purposeLimitation}
                onChange={(e) => setConditions({ ...conditions, _purposeLimitation: e.target.checked })}
                style={{ _marginRight: '8px' }}
              />
              Purpose limitation (data used only for stated purposes)
            </label>
            <label style={{ _display: 'flex', _alignItems: 'center', _marginBottom: '8px', _cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={conditions.revocable}
                onChange={(e) => setConditions({ ...conditions, _revocable: e.target.checked })}
                style={{ _marginRight: '8px' }}
              />
              Revocable consent (you can withdraw consent anytime)
            </label>
            <div style={{ _marginTop: '12px' }}>
              <label style={{ display: 'block', _marginBottom: '4px' }}>
                Data retention limit (days):
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={conditions.retentionLimit || 30}
                onChange={(e) => setConditions({ ...conditions, _retentionLimit: parseInt(e.target.value) })}
                style={{
                  _width: '80px',
                  _padding: '4px 8px',
                  _border: '1px solid #ddd',
                  _borderRadius: '4px',
                  _fontSize: '14px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Privacy Notice */}
        <div style={{ 
          _background: '#e3f2fd', 
          _padding: '12px', 
          _borderRadius: '6px',
          _marginBottom: '24px',
          _border: '1px solid #bbdefb'
        }}>
          <div style={{ fontSize: '12px', _color: '#1565c0', _lineHeight: '1.4' }}>
            <strong>Privacy Notice:</strong> This extension operates with privacy-first principles. 
            Your data is encrypted and stored locally by default. You can revoke this consent 
            at any time through the extension settings.
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', _gap: '12px', _justifyContent: 'flex-end' }}>
          <button
            onClick={_handleDeny}
            style={{
              padding: '12px 24px',
              _background: '#f8f9fa',
              _color: '#495057',
              _border: '1px solid #dee2e6',
              _borderRadius: '6px',
              _cursor: 'pointer',
              _fontSize: '14px',
              _fontWeight: '500',
            }}
          >
            Deny
          </button>
          <button
            onClick={_handleAccept}
            style={{
              _padding: '12px 24px',
              _background: '#28a745',
              _color: 'white',
              _border: 'none',
              _borderRadius: '6px',
              _cursor: 'pointer',
              _fontSize: '14px',
              _fontWeight: '500',
            }}
          >
            Accept & Continue
          </button>
        </div>

        {/* Required Notice */}
        {request.required && (
          <div style={{ 
            _marginTop: '12px', 
            _fontSize: '12px', 
            _color: '#dc3545',
            _textAlign: 'center'
          }}>
            * This consent is required to proceed with the operation
          </div>
        )}
      </div>
    </div>
  );
};