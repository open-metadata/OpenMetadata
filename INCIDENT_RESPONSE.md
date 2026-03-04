# OpenMetadata Incident Response Plan

This document outlines the incident response procedures for security issues in the OpenMetadata project.

## Scope

This incident response plan covers:
- All code within the OpenMetadata organization repositories
- Security vulnerabilities in OpenMetadata services
- Metadata exposure incidents
- Supply chain security issues
- Infrastructure compromises

## Incident Lead

**Primary Incident Lead**: @harshach
- Responsible for coordinating incident response
- Decision authority for security releases
- External communication coordination

**Backup Incident Leads**: @pmbrull, @mohityadav766, @tutte

## Reporting Security Issues

### How to Report

All security issues must be reported privately through one of these channels:

1. **GitHub Security Advisories** (Preferred)
   - Navigate to: https://github.com/open-metadata/OpenMetadata/security/advisories
   - Click "Report a vulnerability"
   - Provide detailed information

2. **Email**: security@open-metadata.org
   - Encrypt sensitive details using our PGP key (available on our website)

### What to Include

- Detailed description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Affected versions
- Any proof-of-concept code (if applicable)

### What NOT to Do

- **DO NOT** create public GitHub issues for security vulnerabilities
- **DO NOT** disclose vulnerabilities on public forums or social media
- **DO NOT** submit pull requests with security fixes without prior coordination

## Response Timeline

- **Initial Response**: Within 24 hours
- **Impact Assessment**: Within 72 hours
- **Resolution Target**: Within 30 days for critical issues
- **Public Disclosure**: Coordinated after fix is available

## Incident Response Phases

### Phase 1: Detection & Initial Response (0-24 hours)

1. **Acknowledge Receipt**
   - Send confirmation to reporter
   - Assign tracking identifier
   - Engage incident lead (@harshach)

2. **Initial Assessment**
   - Verify the vulnerability
   - Determine severity using CVSS scoring
   - Identify affected versions
   - Check if actively exploited

3. **Immediate Containment** (if critical)
   - Disable affected features if possible
   - Notify cloud service providers if applicable
   - Revoke compromised credentials

### Phase 2: Investigation & Coordination (24-72 hours)

1. **Form Response Team**
   - Incident Lead: @harshach
   - Security Engineer(s)
   - Affected component maintainer(s)
   - Communications coordinator

2. **Deep Investigation**
   - Root cause analysis
   - Full impact assessment
   - Check for similar vulnerabilities
   - Review logs for exploitation attempts

3. **Develop Fix**
   - Create patches for supported versions
   - Develop test cases
   - Security review of proposed fix

### Phase 3: Mitigation & Remediation

1. **Prepare Releases**
   - Patch all supported versions
   - Update documentation
   - Prepare security advisory

2. **Coordinate Disclosure**
   - Notify major users under embargo (if applicable)
   - Request CVE assignment
   - Coordinate disclosure date with reporter

3. **Deploy Fixes**
   - Release patched versions
   - Update Docker images
   - Update Helm charts
   - Deploy to cloud services

### Phase 4: Communication

1. **Internal Communication**
   - Update internal teams
   - Brief support teams
   - Update runbooks

2. **External Communication**
   - Publish security advisory
   - Update security page
   - Send notifications to mailing list
   - Social media announcements (if critical)

3. **Credit & Acknowledgment**
   - Credit reporter (unless anonymity requested)
   - Update security acknowledgments page

### Phase 5: Post-Incident Review

1. **Incident Review** (Within 1 week)
   - Timeline review
   - Response effectiveness
   - Lessons learned
   - Process improvements

2. **Security Improvements**
   - Update security practices
   - Enhance testing procedures
   - Update threat model
   - Security training needs

3. **Documentation Updates**
   - Update incident response plan
   - Update security documentation
   - Share learnings with community

## Severity Levels

### Critical (CVSS 9.0-10.0)
- Complete system compromise
- Unauthorized access to all metadata
- Remote code execution
- Authentication bypass
- **Response Time**: Immediate, fix within 24-48 hours

### High (CVSS 7.0-8.9)
- Significant metadata exposure
- Privilege escalation
- Connection credential exposure
- **Response Time**: Within 7 days

### Medium (CVSS 4.0-6.9)
- Limited metadata exposure
- Denial of service
- Information disclosure
- **Response Time**: Within 30 days

### Low (CVSS 0.1-3.9)
- Minor information leakage
- Difficult to exploit issues
- **Response Time**: Next regular release

## Special Considerations for OpenMetadata

### Metadata-Specific Incidents

Since OpenMetadata handles only metadata, not actual data:

1. **Metadata Exposure**
   - Assess what metadata was exposed
   - Determine business impact (not data breach)
   - Notify affected teams about architecture exposure

2. **Connection Configuration**
   - Immediately rotate any exposed credentials
   - Audit connected system access logs
   - Verify read-only permissions maintained

3. **Lineage Information**
   - Assess business process exposure
   - Review competitive sensitivity
   - Update access controls

### Supply Chain Incidents

1. **Dependency Vulnerabilities**
   - Immediate assessment of exposure
   - Patch or workaround deployment
   - Update dependency management

2. **Connector Compromises**
   - Disable affected connectors
   - Audit ingestion logs
   - Verify metadata integrity

## Contact Information

### Security Team
- **Email**: security@open-metadata.org
- **GitHub Security**: https://github.com/open-metadata/OpenMetadata/security
- **Incident Lead**: @harshach

### Escalation Path
1. Security Team
2. Incident Lead (@harshach)
3. OpenMetadata Maintainers
4. Collate (parent organization) if required

## Communication Templates

### Initial Response
```
Subject: Security Report Acknowledged - [TRACKING-ID]

Thank you for reporting this security issue. We take all security reports seriously.

We have assigned tracking ID [TRACKING-ID] to your report and will investigate immediately.

Expected timeline:
- Initial assessment: Within 72 hours
- Resolution target: Within 30 days

We will keep you updated on our progress. Please keep this issue confidential until we coordinate disclosure.

Thank you for helping keep OpenMetadata secure.
```

### Security Advisory Template
```
# Security Advisory: [CVE-ID]

**Affected Component**: OpenMetadata [Component]
**Severity**: [Critical/High/Medium/Low]
**CVSS Score**: [Score]
**Affected Versions**: [Versions]
**Fixed Versions**: [Versions]

## Summary
[Brief description]

## Impact
[Detailed impact assessment]

## Mitigation
[Steps to mitigate if patch cannot be immediately applied]

## Fix
[How to upgrade/patch]

## Credit
Discovered by [Reporter Name/Organization]

## References
- [CVE Link]
- [Additional References]
```

## Security Disclosure Policy

- We request 90 days to address reported vulnerabilities
- We coordinate disclosure timing with reporters
- We credit reporters unless anonymity is requested
- We maintain a security acknowledgments page
- We follow responsible disclosure practices

## Training & Preparedness

### Regular Activities
- Quarterly incident response drills
- Annual security training for maintainers
- Regular dependency audits
- Penetration testing (annually)

### Required Training
- OWASP Top 10 awareness
- Secure coding practices
- Incident response procedures
- Communication protocols

## References

- [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories)
- [CVE Process](https://cve.mitre.org/)
- [FIRST PSIRT Framework](https://www.first.org/standards/frameworks/psirts/)
- [NIST Incident Response Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf)

---

*Last Updated: 2025-01-28*
*Version: 1.0*
*Next Review: Quarterly*