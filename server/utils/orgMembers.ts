import { getInstallationOctokit } from '../github/appClient';
import { getUserModel } from '../models/User';

/**
 * Fetch organization members and update their installationIds
 * This handles the case where an app is installed on an organization
 * and we need to link it to all org members who are users in our system
 */
export async function syncOrgMembersToInstallation(
  installationId: number,
  orgLogin: string
): Promise<{ updated: number; errors: number }> {
  try {
    console.log(`🔵 Syncing org members for installation ${installationId} (org: ${orgLogin})...`);
    
    // Get installation-level Octokit to fetch org members
    const installationOctokit = await getInstallationOctokit(installationId);
    
    // Fetch organization members
    // Note: This requires the app to have 'members' permission for the organization
    let orgMembers: string[] = [];
    
    try {
      // Try to get org members using the installation auth
      // GET /orgs/{org}/members returns members of the organization
      const membersResponse = await installationOctokit.paginate(
        installationOctokit.orgs.listMembers,
        {
          org: orgLogin,
        }
      );
      
      orgMembers = membersResponse.map((member: any) => member.login);
      console.log(`   ✅ Found ${orgMembers.length} members in org ${orgLogin}`);
    } catch (membersError: any) {
      console.warn(`   ⚠️  Failed to fetch org members via installation auth: ${membersError.message}`);
      console.warn(`   This might require 'members' permission for the GitHub App`);
      
      // Alternative: Try public members endpoint (doesn't require special permissions)
      try {
        const publicMembersResponse = await installationOctokit.paginate(
          installationOctokit.orgs.listPublicMembers,
          {
            org: orgLogin,
          }
        );
        orgMembers = publicMembersResponse.map((member: any) => member.login);
        console.log(`   ✅ Found ${orgMembers.length} public members in org ${orgLogin}`);
        console.warn(`   ⚠️  Note: Only public members were found. Private members require 'members' permission.`);
      } catch (publicError: any) {
        console.warn(`   ⚠️  Failed to fetch public members: ${publicError.message}`);
        // Continue with empty array - we'll still try to match by existing users
      }
    }
    
    // If we couldn't fetch members, we can't sync
    if (orgMembers.length === 0) {
      console.log(`   ℹ️  No org members found or couldn't fetch them. Skipping sync.`);
      console.log(`   💡 Tip: Ensure your GitHub App has 'members' permission for organizations.`);
      return { updated: 0, errors: 0 };
    }
    
    // Find all users in our DB who match these GitHub usernames
    const User = getUserModel();
    const matchingUsers = await User.find({
      username: { $in: orgMembers },
    });
    
    console.log(`   Found ${matchingUsers.length} users in our DB matching org members`);
    
    // Update each user's installationIds
    let updated = 0;
    let errors = 0;
    
    for (const user of matchingUsers) {
      try {
        if (!user.installationIds.includes(installationId)) {
          user.installationIds.push(installationId);
          await user.save();
          updated++;
          console.log(`   ✅ Linked installation ${installationId} to user ${user.username}`);
        } else {
          console.log(`   ℹ️  User ${user.username} already has installation ${installationId}`);
        }
      } catch (userError: any) {
        console.warn(`   ⚠️  Failed to update user ${user.username}: ${userError.message}`);
        errors++;
      }
    }
    
    console.log(`✅ Org member sync complete: ${updated} users updated, ${errors} errors`);
    return { updated, errors };
  } catch (error: any) {
    console.error(`❌ Error syncing org members:`, error.message);
    if (error.response) {
      console.error(`   Response status: ${error.response.status}`);
      console.error(`   Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    return { updated: 0, errors: 1 };
  }
}

